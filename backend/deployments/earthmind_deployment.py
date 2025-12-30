import numpy as np
import torch
from ray import serve
from PIL import Image

from utils_pkg import EarthMindEfficientPreprocessor, mask_to_base64, get_cleaned_obbs, get_seg_hidden_states


@serve.deployment
class EarthMindDeployment:
    def __init__(self, model_path: str, load_8bit: bool = False, dtype: str = "auto", device: str = None):
        from transformers import AutoModelForCausalLM, AutoTokenizer
        
        self.model_path = model_path
        self.load_8bit = load_8bit
        self.dtype = dtype

        if device is None:
            device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.device = device

        # Load model and tokenizer
        model_kwargs = {"trust_remote_code": True}

        if self.dtype == "float16":
            model_kwargs["torch_dtype"] = torch.float16
        elif self.dtype == "bfloat16":
            model_kwargs["torch_dtype"] = torch.bfloat16
        elif self.dtype == "float32":
            model_kwargs["torch_dtype"] = torch.float32

        if load_8bit:
            model_kwargs.update({"load_in_8bit": True, "device_map": "auto"})
        else:
            # Prefer GPU if available
            if torch.cuda.is_available():
                model_kwargs.update({"device_map": "cuda:0"})
            else:
                model_kwargs.update({"device_map": "cpu"})

        # If model_path is a local directory, use local_files_only to prevent HuggingFace validation errors
        import os
        if os.path.isdir(self.model_path):
            model_kwargs["local_files_only"] = True

        self.model = AutoModelForCausalLM.from_pretrained(self.model_path, **model_kwargs)
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_path, trust_remote_code=True, local_files_only=os.path.isdir(self.model_path))

        # Initialize prediction config immediately to avoid runtime errors with 8-bit models
        if self.load_8bit:
            original_to = self.model.to
            # Monkeypatch .to() to be a no-op during initialization
            self.model.to = lambda *args, **kwargs: self.model
            try:
                # Use the model's actual dtype instead of forcing bfloat16
                self.model.preparing_for_generation(self.tokenizer, torch_dtype=self.model.dtype)
            finally:
                self.model.to = original_to
        else:
            # For non-8bit, just initialize normally
            self.model.preparing_for_generation(self.tokenizer, torch_dtype=self.model.dtype)
        
        # Initialize efficient preprocessor for VQA tasks
        self.efficient_preprocessor = EarthMindEfficientPreprocessor(
            self.model, self.tokenizer, device=self.device, area_threshold=600000
        )

    async def predict(self, text: str, frames: list, select: int = -1, task_type: str = None):
        if not text.startswith("<image>"):
            text = "<image>" + text

        # Run model inference
        try:
            # Use efficient preprocessing for VQA tasks
            if task_type == "vqa" and frames:
                # Select the appropriate image
                if select and select > 0:
                    img = frames[select - 1]
                else:
                    img = frames[0]
                
                # Get selected tiles using efficient preprocessor
                selected_tiles = self.efficient_preprocessor.process(
                    img, text, threshold=0.25, max_tiles=None
                )
                
                # Prepare inputs with selected tiles
                pixel_values = [self.model.transformer(tile) for tile in selected_tiles]
                pixel_values = torch.stack(pixel_values).to(self.model.dtype).to(self.device)
                
                num_image_tokens = len(selected_tiles) * self.model.patch_token
                
                # Prepare text
                image_token_str = f'{self.model.IMG_START_TOKEN}' \
                                  f'{self.model.IMG_CONTEXT_TOKEN * num_image_tokens}' \
                                  f'{self.model.IMG_END_TOKEN}'
                                  
                text_input = text.replace('<image>', image_token_str)
                input_text = self.model.template['INSTRUCTION'].format(
                    input=text_input, round=1, bot_name=self.model.bot_name)
                    
                ids = self.tokenizer.encode(input_text)
                ids = torch.tensor(ids).to(self.device).unsqueeze(0)
                attention_mask = torch.ones_like(ids, dtype=torch.bool)
                
                # Grounding inputs
                g_image = np.array(img)
                g_image = self.model.extra_image_processor.apply_image(g_image)
                g_pixel_values = torch.from_numpy(g_image).permute(2, 0, 1).contiguous().to(self.model.dtype)
                extra_pixel_values = [g_pixel_values]
                g_pixel_values = torch.stack([
                    self.model.grounding_encoder.preprocess_image(pixel) for pixel in extra_pixel_values
                ]).to(self.model.dtype).to(self.device)
                
                mm_inputs = {
                    'pixel_values': pixel_values,
                    'input_ids': ids,
                    'attention_mask': attention_mask,
                    'position_ids': None,
                    'past_key_values': None,
                    'labels': None,
                    'prompt_masks': None,
                    'vp_overall_mask': None,
                }
                
                # Generate
                generate_output = self.model.generate(
                    **mm_inputs,
                    generation_config=self.model.gen_config,
                    streamer=None,
                    bos_token_id=self.tokenizer.bos_token_id,
                    stopping_criteria=self.model.stop_criteria,
                    output_hidden_states=True,
                    return_dict_in_generate=True
                )
                
                prediction = self.tokenizer.decode(
                    generate_output.sequences[0], skip_special_tokens=False).strip()


                # Extract masks
                ret_masks = []
                hidden_states = generate_output.hidden_states
                last_hidden_states = [item[-1][0] for item in hidden_states]
                last_hidden_states = torch.cat(last_hidden_states, dim=0)
                seg_hidden_states = get_seg_hidden_states(
                    last_hidden_states, generate_output.sequences[0][:-1],
                    seg_id=self.model.seg_token_idx
                )
                
                all_seg_hidden_states = self.model.text_hidden_fcs(seg_hidden_states)
                
                num_frames = 1 # Single image
                ori_image_size = img.size
                
                import torch.nn.functional as F
                
                for seg_hidden_states in all_seg_hidden_states:
                    seg_hidden_states = seg_hidden_states.unsqueeze(0)
                    # g_pixel_values is already prepared in step 4
                    sam_states = self.model.grounding_encoder.get_sam2_embeddings(g_pixel_values)
                    pred_masks = self.model.grounding_encoder.language_embd_inference(sam_states, [seg_hidden_states] * num_frames)
                    w, h = ori_image_size
                    masks = F.interpolate(pred_masks, size=(h, w), mode='bilinear', align_corners=False)
                    masks = masks[:, 0]
                    masks = masks.sigmoid() > 0.5
                    masks = masks.cpu().numpy()
                    ret_masks.append(masks)

                result = {"prediction": prediction}
                if ret_masks:
                    # Combine all masks
                    combined_mask = np.zeros_like(ret_masks[0], dtype=bool)
                    for m in ret_masks:
                        combined_mask = combined_mask | m
                    result["mask"] = combined_mask
            else:
                # Standard inference for non-VQA tasks
                if select and select > 0:
                    img = frames[select - 1]
                    result = self.model.predict_forward(image=img, text=text, tokenizer=self.tokenizer)
                else:
                    result = self.model.predict_forward(video=frames, text=text, tokenizer=self.tokenizer)
        except Exception as e:
            raise RuntimeError(f"Model inference failed: {e}")

        prediction = result.get("prediction") if isinstance(result, dict) else str(result)
        mask_b64 = ""
        obbs = []
        
        # Check for mask in result - handle both "mask" (from VQA path) and "prediction_masks" (from predict_forward)
        if isinstance(result, dict):
            mask_np = None
            
            if "mask" in result:
                # From VQA path - already a combined numpy array
                mask_np = result["mask"]
            elif "prediction_masks" in result and result["prediction_masks"]:
                # From predict_forward - list of mask arrays
                ret_masks = result["prediction_masks"]
                if len(ret_masks) > 0:
                    # Combine all masks
                    combined_mask = np.zeros_like(ret_masks[0], dtype=bool)
                    for m in ret_masks:
                        combined_mask = combined_mask | m
                    mask_np = combined_mask
            
            if mask_np is not None:
                mask_b64 = mask_to_base64(mask_np)
                obbs = get_cleaned_obbs(mask_np)
        
        token = '<|end|>'
        if prediction.endswith(token):
            prediction = prediction[:-len(token)].strip()
        
        return {"prediction": prediction, "mask": mask_b64, "obbs": obbs}
