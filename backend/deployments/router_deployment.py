import io
import os
import random
import urllib.request
import base64

import numpy as np
from ray import serve
from PIL import Image
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from utils_pkg.utils import calculate_area_from_mask

import re


def pil_from_base64(b64_string: str) -> Image.Image:
    try:
        decoded = base64.b64decode(b64_string)
        return Image.open(io.BytesIO(decoded)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Failed to parse base64 image: {e}")


def parse_binary_response(response: str) -> str:
    """Parse binary response to strictly return 'Yes' or 'No'."""
    response_lower = response.strip().lower()
    has_yes = "yes" in response_lower
    has_no = "no" in response_lower
    
    # Check for exclusive presence
    if has_yes and not has_no:
        return "Yes"
    elif has_no and not has_yes:
        return "No"
    # Fallback: default to No if both or neither present
    return "No"


def parse_numeric_response(response: str) -> float:
    """Parse response to extract numeric value as float."""
    # Try to find any number (integer or float) in the response
    numbers = re.findall(r'-?\d+\.?\d*', response)
    if numbers:
        # Return the first number found as float
        return float(numbers[0])
    return 0.0


def parse_semantic_response(response: str) -> str:
    """Parse response to limit to 1-5 words."""
    words = response.strip().split()
    # Take only the first 5 words
    return " ".join(words[:10])


app = FastAPI()
# CORS is handled by Ray Serve proxy in serve.py


@serve.deployment
@serve.ingress(app)
class RouterDeployment:
    def __init__(self, earthmind_handle, remotesam_handle, classifier_handle=None, phi_handle=None):
        self.earthmind = earthmind_handle
        self.remotesam = remotesam_handle
        self.classifier = classifier_handle
        self.phi = phi_handle
        self.models = ["earthmind", "remotesam"]

    @app.get("/health")
    async def health(self):
        """Health check endpoint for Docker/Kubernetes health probes."""
        return {"status": "healthy", "models": self.models}

    @app.post("/predict")
    async def predict(self, request: Request):
        return await self.handle_request(request)

    @app.post("/geoNLI/eval")
    async def evaluate(self, request: Request):
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")

        # Extract image
        input_image = body.get("input_image", {})
        image_url = input_image.get("image_url")
        
        img = None
        if image_url:
            try:
                if image_url.startswith("http"):
                    # Use a user agent just in case
                    req = urllib.request.Request(
                        image_url, 
                        data=None, 
                        headers={'User-Agent': 'Mozilla/5.0'}
                    )
                    with urllib.request.urlopen(req) as url:
                        f = io.BytesIO(url.read())
                        img = Image.open(f).convert("RGB")
                elif os.path.exists(image_url):
                    img = Image.open(image_url).convert("RGB")
                else:
                    raise ValueError(f"Could not load image from {image_url}")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to load image: {e}")
        else:
             raise HTTPException(status_code=400, detail="Missing image_url in input_image")

        frames = [img]
        queries = body.get("queries", {})
        
        # Get GSD (Ground Sample Distance) from metadata for area calculation
        metadata = input_image.get("metadata", {})
        gsd = metadata.get("spatial_resolution_m", 1.0)  # Default to 1.0 if not provided
        
        # Launch tasks in parallel
        tasks = {}
        area_query_detected = False  # Flag to track if numeric query is an area query
        
        # Caption
        #TODO: Add caption prompt in frontend also
        if "caption_query" in queries:
            extra_instruct = " Provide a concise summary for simple images (approx. 50 words) and a comprehensive description for complex images, staying within a 10 to 200 word limit. Give your output STRICTLY in a single paragraph."
            instr = queries["caption_query"].get("instruction", "") + extra_instruct
            tasks["caption"] = self.earthmind.predict.remote(instr, frames)
            
        # Grounding
        if "grounding_query" in queries:
            instr = queries["grounding_query"].get("instruction", "")
            # Refine prompt using Phi-3.5 before passing to RemoteSAM
            if self.phi:
                instr = await self.phi.refine_prompt.remote(instr)
            tasks["grounding"] = self.remotesam.predict.remote(instr, frames)
            
        # Attributes
        attr_query = queries.get("attribute_query", {})
        if "binary" in attr_query:
            instr = attr_query["binary"].get("instruction", "")
            # Add strict Yes/No constraint to prompt
            instr = f"{instr} Answer strictly with only 'Yes' or 'No', nothing else."
            tasks["binary"] = self.earthmind.predict.remote(instr, frames)
        if "numeric" in attr_query:
            instr = attr_query["numeric"].get("instruction", "")
            # Check if the query contains "area" - route to RemoteSAM for segmentation-based area calculation
            if "area" in instr.lower():
                area_query_detected = True
                # Refine prompt using Phi-3.5 before passing to RemoteSAM
                refined_instr = instr
                if self.phi:
                    refined_instr = await self.phi.refine_prompt.remote(instr)
                tasks["numeric_area"] = self.remotesam.predict.remote(refined_instr, frames)
            else:
                # Add strict numeric constraint to prompt
                instr = f"{instr} Answer with only a numeric value, nothing else."
                tasks["numeric"] = self.earthmind.predict.remote(instr, frames)
        if "semantic" in attr_query:
            instr = attr_query["semantic"].get("instruction", "")
            # Add strict 1-5 words constraint to prompt
            instr = f"{instr} Answer in only 1 to 5 words, nothing more."
            tasks["semantic"] = self.earthmind.predict.remote(instr, frames)
            
        # Await all results
        results = {}
        for key, ref in tasks.items():
            results[key] = await ref
            
        # Construct Response
        response = body
        
        if "caption" in results:
            response["queries"]["caption_query"]["response"] = results["caption"].get("prediction", "") 
            
        if "grounding" in results:
            obbs = results["grounding"].get("obbs", [])
            formatted_obbs = []
            for idx, box in enumerate(obbs):
                formatted_obbs.append({
                    "object-id": str(idx+1),
                    "obbox": box
                })
            response["queries"]["grounding_query"]["response"] = formatted_obbs
            
        if "attribute_query" in response["queries"]:
            if "binary" in results:
                raw_response = results["binary"].get("prediction", "")
                response["queries"]["attribute_query"]["binary"]["response"] = parse_binary_response(raw_response)
            if "numeric" in results:
                raw_response = results["numeric"].get("prediction", "")
                response["queries"]["attribute_query"]["numeric"]["response"] = parse_numeric_response(raw_response)
            if "numeric_area" in results:
                # Calculate area from segmentation mask
                mask_b64 = results["numeric_area"].get("mask", "")
                if mask_b64:
                    try:
                        # Decode base64 mask to numpy array
                        mask_bytes = base64.b64decode(mask_b64)
                        mask_img = Image.open(io.BytesIO(mask_bytes))
                        mask_np = np.array(mask_img)
                        
                        # Calculate area using GSD
                        area = calculate_area_from_mask(mask_np, gsd)
                        response["queries"]["attribute_query"]["numeric"]["response"] = float(area)
                    except Exception as e:
                        print(f"Error calculating area from mask: {e}")
                        response["queries"]["attribute_query"]["numeric"]["response"] = 0.0
                else:
                    response["queries"]["attribute_query"]["numeric"]["response"] = 0.0
            if "semantic" in results:
                raw_response = results["semantic"].get("prediction", "")
                response["queries"]["attribute_query"]["semantic"]["response"] = parse_semantic_response(raw_response)
                
        return JSONResponse(response)

    @app.post("/earthmind")
    async def predict_earthmind(self, request: Request):
        return await self.handle_request(request, force_model="earthmind")

    @app.post("/remotesam")
    async def predict_remotesam(self, request: Request):
        return await self.handle_request(request, force_model="remotesam")

    async def handle_request(self, request: Request, force_model: str = None):
        """Accepts JSON with either:
        - `images`: list of base64-encoded image strings (frames)
        - `image`: single base64-encoded image string
        - `image_paths`: list of local file paths (server-side)
        And a `text` field with the prompt. Optionally `select` (1-based index) to select a single frame.
        """
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")

        text = body.get("text", "")
        select = int(body.get("select", -1)) if body.get("select") is not None else -1

        frames = []
        if "images" in body and isinstance(body["images"], list):
            try:
                for b64 in body["images"]:
                    frames.append(pil_from_base64(b64))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        elif "image" in body and isinstance(body["image"], str):
            try:
                frames.append(pil_from_base64(body["image"]))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        elif "image_paths" in body and isinstance(body["image_paths"], list):
            try:
                for p in body["image_paths"]:
                    if not os.path.exists(p):
                        raise HTTPException(status_code=400, detail=f"Image path not found: {p}")
                    frames.append(Image.open(p).convert("RGB"))
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed opening local image: {e}")
        else:
            raise HTTPException(status_code=400, detail="No images provided. Send `images`, `image`, or `image_paths`.")

        # Router Logic
        # Allow forcing model via request for testing
        # Check if query contains "area" keyword for special area calculation
        is_area_query = "area" in text.lower()
        gsd = body.get("gsd", 1.0)  # Get GSD from request body, default to 1.0
        
        if force_model:
            selected_model = force_model
        else:
            force_model_body = body.get("model")
            if force_model_body in self.models:
                selected_model = force_model_body
            elif is_area_query:
                # Area queries should use RemoteSAM for segmentation-based calculation
                selected_model = "remotesam"
            elif self.classifier:
                # Use classifier
                task_type = await self.classifier.predict.remote(text)
                print(f"Classifier predicted task: {task_type}")
                if task_type in ["caption", "vqa"]:
                    selected_model = "earthmind"
                elif task_type in ["grounding", "area"]:
                    selected_model = "remotesam"
                else:
                    selected_model = "earthmind" # Default
            else:
                # Currently random selection
                selected_model = random.choice(self.models)

        # selected_model = "earthmind"
            
        print(f"Router selected: {selected_model}")
        
        # Determine task type for efficient preprocessing
        task_type = None
        if self.classifier:
            task_type = await self.classifier.predict.remote(text)
            print(f"Task type for preprocessing: {task_type}")
        
        try:
            if is_area_query and not force_model:
                # Special handling for area queries: use RemoteSAM and calculate area from mask
                refined_text = text
                if self.phi:
                    refined_text = await self.phi.refine_prompt.remote(text)
                # Call RemoteSAM with refined prompt
                remotesam_result = await self.remotesam.predict.remote(refined_text, frames, select)
                
                # Calculate area from segmentation mask
                mask_b64 = remotesam_result.get("mask", "")
                if mask_b64:
                    try:
                        # Decode base64 mask to numpy array
                        mask_bytes = base64.b64decode(mask_b64)
                        mask_img = Image.open(io.BytesIO(mask_bytes))
                        mask_np = np.array(mask_img)
                        
                        # Calculate area using GSD
                        area = calculate_area_from_mask(mask_np, gsd)
                        result = {
                            "prediction": str(area),
                            "mask": mask_b64,
                            "area_sq_meters": area,
                            "gsd_used": gsd
                        }
                    except Exception as e:
                        print(f"Error calculating area from mask: {e}")
                        result = {"prediction": "0.0", "error": str(e)}
                else:
                    result = {"prediction": "0.0", "error": "No mask returned from segmentation"}
            elif selected_model == "earthmind":
                # Call EarthMind with task_type
                result = await self.earthmind.predict.remote(text, frames, select, task_type)
            else:
                # Refine prompt using Phi-3.5 before passing to RemoteSAM
                refined_text = text
                if self.phi:
                    refined_text = await self.phi.refine_prompt.remote(text)
                # Call RemoteSAM with refined prompt
                result = await self.remotesam.predict.remote(refined_text, frames, select)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Model execution failed: {e}")

        return JSONResponse(result)
