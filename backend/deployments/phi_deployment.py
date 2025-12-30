import logging
import torch
from ray import serve

# Set up logging
logger = logging.getLogger("phi_deployment")
logger.setLevel(logging.DEBUG)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('[%(asctime)s] [PHI] %(levelname)s: %(message)s'))
    logger.addHandler(handler)


SYSTEM_INSTRUCTION = """You are a Refiner for Visual Grounding (RemoteSAM/CLIP).
Your goal is to prepare text for a segmentation model by removing "command syntax" and "meta-noise" while preserving every visual detail.

CRITICAL: Output ONLY the refined phrase. NO explanations, NO notes, NO comments, NO parentheses, NO additional text. Just the refined noun phrase on a single line.

RULES:
1. TARGET IDENTIFICATION:
   - If input is a COMMAND ("Find the car"), extract the object ("car").
   - If input is a DESCRIPTION ("The car is red"), keep the description ("car is red").

2. THE "KILL" LIST (Strictly Remove):
   - "in the image", "seen in the image", "visible in the image", "provided image".
   - "oriented bounding box", "bounding box", "coordinates", "mask".
   - "Locate and return", "Find", "Detect", "Segment", "Show me", "give me".
   - "One of the" (e.g., "One of the ships" -> "ship").

3. THE "KEEP" LIST (Strictly Preserve):
   - Relative clauses ("that has a platform", "extending into water").
   - Edge relationships ("cut off by the border", "bottom edge").
   - Spatial terms ("extreme right", "bottom-most", "top left").

4. FORMATTING:
   - Output must be a noun phrase or a descriptive phrase.
   - Remove "located" or "placed" if they are passive filler.
   - Output ONLY the phrase, nothing else.

### EXAMPLES
Input: Locate and return oriented bounding boxes for the aircrafts seen in the image.
Output: aircrafts

Input: Find the bounding box of the truck on the top left.
Output: truck on the top left

Input: Bounding box of vehicle located at the top-most position in the provided image.
Output: vehicle at the top-most position

Input: The bottom-most harbor in the image has a platform extending into the water and is closer to the bottom edge of the image.
Output: bottom-most harbor having a platform extending into the water and closer to the bottom edge

Input: What is the orientation of the road in the image?
Output: road

Input: give me the bounding box of the stadium in the image
Output: stadium
"""


@serve.deployment
class PhiDeployment:
    """Phi-3.5 Mini Instruct deployment for prompt refinement before RemoteSAM."""
    
    def __init__(self, model_id: str = "microsoft/Phi-3.5-mini-instruct", device: str = None):
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device
        
        print(f"Loading Phi-3.5 Mini Instruct from {model_id} on {device} (4-bit quantized)")
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        
        # 4-bit quantization config for reduced memory usage
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True
        )
        
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            quantization_config=quantization_config,
            device_map="auto",
            trust_remote_code=True
        )
        print("Phi-3.5 Mini Instruct loaded (4-bit).")
    
    async def refine_prompt(self, user_query: str) -> str:
        """
        Refines the user query by removing command syntax and meta-noise
        while preserving visual details for RemoteSAM.
        
        Args:
            user_query: The original user query/prompt
            
        Returns:
            The refined prompt suitable for RemoteSAM
        """
        messages = [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": f"Input: {user_query}\nOutput:"}
        ]
        
        # Create the prompt using the model's specific template
        inputs = self.tokenizer.apply_chat_template(
            messages,
            add_generation_prompt=True,
            return_tensors="pt"
        ).to(self.device)
        
        # Generate with strict limits to prevent hallucination
        outputs = self.model.generate(
            inputs,
            max_new_tokens=30,  # Keep it short
            temperature=0.1,   # Low temp = deterministic
            do_sample=False,   # Greedy decoding is usually best for extraction
            use_cache=False    # Avoid DynamicCache compatibility issues
        )
        
        # Decode and strip the prompt
        response = self.tokenizer.decode(
            outputs[0][inputs.shape[1]:], 
            skip_special_tokens=True
        )
        
        refined = response.strip()
        
        # Debug logging for prompt refinement (using print for Ray Serve visibility)
        print("=" * 60)
        print("[PHI] PROMPT REFINEMENT")
        print(f"[PHI]   INPUT:  '{user_query}'")
        print(f"[PHI]   OUTPUT: '{refined}'")
        print("=" * 60)
        
        return refined
