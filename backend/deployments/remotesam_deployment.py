import os
import sys
import numpy as np
import torch
from ray import serve

from utils_pkg import mask_to_base64, get_cleaned_obbs


@serve.deployment
class RemoteSAMDeployment:
    def __init__(self, checkpoint_path: str, device: str = None):
        # Import here to avoid top-level dependency issues
        import cv2
        import numpy as np
        
        # Add RemoteSAM directory to sys.path
        # We assume the checkpoint is at .../RemoteSAM/pretrained_weights/file.pth
        # So we go up two levels to get to .../RemoteSAM
        remotesam_root = os.path.abspath(os.path.join(os.path.dirname(checkpoint_path), ".."))
        print(f"Adding {remotesam_root} to sys.path for RemoteSAM")
        
        # Add all necessary paths for RemoteSAM imports
        paths_to_add = [
            remotesam_root,  # For 'tasks', 'utils', 'transforms', 'args', 'lib'
            os.path.join(remotesam_root, "tasks"),  # For 'code' subpackage access
            os.path.join(remotesam_root, "tasks", "code"),  # For relative imports within code
        ]
        
        for path in paths_to_add:
            if path not in sys.path:
                sys.path.insert(0, path)
            else:
                # Move to front if already exists but not at front
                sys.path.remove(path)
                sys.path.insert(0, path)
        
        # Also change working directory to RemoteSAM root for relative file access
        original_cwd = os.getcwd()
        os.chdir(remotesam_root)
            
        try:
            import tasks
            print(f"Imported 'tasks' from: {os.path.dirname(tasks.__file__) if hasattr(tasks, '__file__') else 'unknown'}")
            from tasks.code.model import RemoteSAM, init_demo_model
        except ImportError as e:
            print(f"Failed to import RemoteSAM modules: {e}")
            print(f"sys.path: {sys.path}")
            print(f"Current working directory: {os.getcwd()}")
            print(f"RemoteSAM root exists: {os.path.exists(remotesam_root)}")
            print(f"Tasks folder exists: {os.path.exists(os.path.join(remotesam_root, 'tasks'))}")
            os.chdir(original_cwd)
            raise e

        if device is None:
            device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.device = device
        
        print(f"Loading RemoteSAM from {checkpoint_path} on {device}")
        model = init_demo_model(checkpoint_path, device)
        self.model = RemoteSAM(model, device, use_EPOC=True)
        print("RemoteSAM loaded.")

    async def predict(self, text: str, frames: list, select: int = -1):
        import cv2
        import numpy as np
        
        # RemoteSAM typically works on a single image. 
        # If multiple frames, use the selected one or the first one.
        if not frames:
            raise ValueError("No images provided for RemoteSAM")
            
        if select and select > 0:
            pil_img = frames[select - 1]
        else:
            pil_img = frames[0]
            
        # Convert PIL to numpy (RGB)
        image_np = np.array(pil_img)
        
        # RemoteSAM expects RGB image (based on test.py: cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        # But wait, test.py reads with cv2.imread (BGR), then converts to RGB.
        # Our image_np is already RGB from PIL.
        # So we pass it directly.
        
        try:
            mask = self.model.referring_seg(image=image_np, sentence=text)
        except Exception as e:
            raise RuntimeError(f"RemoteSAM inference failed: {e}")

        # mask is a numpy array
        mask_b64 = mask_to_base64(mask)
        obbs = get_cleaned_obbs(mask)
        
        return {
            "prediction": "",
            "mask": mask_b64,
            "obbs": obbs
        }
