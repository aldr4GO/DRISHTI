import torch
import numpy as np



def find_closest_aspect_ratio(aspect_ratio, target_ratios, width, height, image_size):
    best_ratio_diff = float('inf')
    best_ratio = (1, 1)
    area = width * height
    
    for ratio in target_ratios:
        target_aspect_ratio = ratio[0] / ratio[1]
        ratio_diff = abs(aspect_ratio - target_aspect_ratio)
        
        if ratio_diff < best_ratio_diff:
            best_ratio_diff = ratio_diff
            best_ratio = ratio
        elif ratio_diff == best_ratio_diff:
            if area > 0.5 * image_size * image_size * ratio[0] * ratio[1]:
                best_ratio = ratio
    return best_ratio

def dynamic_preprocess(image, target_ratios, image_size=448, use_thumbnail=False):
    orig_width, orig_height = image.size
    aspect_ratio = orig_width / orig_height
    
    best_ratio = find_closest_aspect_ratio(aspect_ratio, target_ratios, orig_width, orig_height, image_size)

    target_width = image_size * best_ratio[0]
    target_height = image_size * best_ratio[1]
    blocks = best_ratio[0] * best_ratio[1]

    cols = best_ratio[0]
    rows = best_ratio[1]

    resized_img = image.resize((target_width, target_height))
    
    processed_images = []
    w_step = image_size
    h_step = image_size
    
    for i in range(blocks):
        c = i % cols
        r = i // cols
        box = (c * w_step, r * h_step, (c + 1) * w_step, (r + 1) * h_step)
        processed_images.append(resized_img.crop(box))
        
    if use_thumbnail and len(processed_images) != 1:
        thumbnail_img = image.resize((image_size, image_size))
        processed_images.append(thumbnail_img)
        
    return processed_images, (cols, rows)

class EarthMindEfficientPreprocessor:
    def __init__(self, model, tokenizer, device="cuda", area_threshold=600000):
        self.model = model
        self.tokenizer = tokenizer
        self.device = device
        self.area_threshold = area_threshold
        
        # Pre-calculate target ratios
        self.min_num = model.min_dynamic_patch
        self.max_num = model.max_dynamic_patch
        self.target_ratios = sorted({(i, j)
                         for n in range(self.min_num, self.max_num + 1)
                         for i in range(1, n + 1) for j in range(1, n + 1)
                         if i * j <= self.max_num and i * j >= self.min_num}, key=lambda x: x[0] * x[1])

    def _get_input_ids(self, image_tensor, prompt_text):
        config = self.model.config.vision_config
        patch_size = config.patch_size
        downsample_ratio = self.model.downsample_ratio
        
        _, _, H, W = image_tensor.shape
        
        num_image_tokens = int((H // patch_size) * (W // patch_size) * (downsample_ratio ** 2))
        
        image_token_str = f'{self.model.IMG_START_TOKEN}' \
                          f'{self.model.IMG_CONTEXT_TOKEN * num_image_tokens}' \
                          f'{self.model.IMG_END_TOKEN}'
        
        text = prompt_text.replace('<image>', image_token_str)
        input_text = self.model.template['INSTRUCTION'].format(
            input=text, round=1, bot_name=self.model.bot_name)
            
        ids = self.tokenizer.encode(input_text)
        return torch.tensor(ids).to(self.device).unsqueeze(0)

    def _get_gradient_weighted_attention_map(self, image_tensor, prompt_text):
        import torch.nn.functional as F
        with torch.no_grad():
            prompt_ids = self._get_input_ids(image_tensor, prompt_text)
            
            data = {
                'pixel_values': image_tensor.unsqueeze(0),
                'input_ids': prompt_ids,
                'attention_mask': torch.ones_like(prompt_ids, dtype=torch.bool),
                'position_ids': None,
                'labels': None,
                'vp_overall_mask': None,
                'prompt_masks': None
            }
            
            outputs = self.model(data, output_attentions=True)
            
            img_token_id = self.model.img_context_token_id
            is_img = (prompt_ids[0] == img_token_id)
            is_text = ~is_img
            
            # Using layers 19 through 29
            attn_weights_list = outputs.attentions[19:30] 
            avg_attn = torch.stack(attn_weights_list).mean(dim=0)
            
            text_attn = avg_attn[:, :, is_text, :]
            text_img_attn = text_attn[:, :, :, is_img]
            heatmap = text_img_attn.mean(dim=(0, 1, 2))
            
            config = self.model.config.vision_config
            patch_size = config.patch_size
            downsample_ratio = self.model.downsample_ratio
            _, _, H, W = image_tensor.shape
            h_tokens = int((H // patch_size) * downsample_ratio)
            w_tokens = int((W // patch_size) * downsample_ratio)
            
            # Reshaping Logic
            if heatmap.numel() != h_tokens * w_tokens:
                total_tokens = heatmap.numel()
                ratio = W / H
                h_est = int(np.sqrt(total_tokens / ratio))
                w_est = total_tokens // h_est
                while h_est > 0:
                    if total_tokens % h_est == 0:
                        w_est = total_tokens // h_est
                        curr_ratio = w_est / h_est
                        if 0.5 * ratio <= curr_ratio <= 2.0 * ratio:
                            break
                    h_est -= 1
                heatmap = heatmap.view(1, 1, h_est, w_est)
            else:
                heatmap = heatmap.view(1, 1, h_tokens, w_tokens)
            
            return heatmap

    def process(self, image_pil, prompt, threshold=0.25, max_tiles=None):
        import torch.nn.functional as F
        # Check image dimensions
        width, height = image_pil.size
        image_area = width * height
        
        # Determine if we should use token pruning
        use_pruning = image_area > self.area_threshold
        
        if use_pruning:
            print(f"Image area ({image_area}) > {self.area_threshold}. Using token pruning.")
        else:
            print(f"Image area ({image_area}) <= {self.area_threshold}. Skipping pruning (using all tiles).")
        
        # Handle max_tiles override
        target_ratios = self.target_ratios
        if max_tiles is not None:
             target_ratios = sorted({(i, j)
                         for n in range(self.min_num, max_tiles + 1)
                         for i in range(1, n + 1) for j in range(1, n + 1)
                         if i * j <= max_tiles and i * j >= self.min_num}, key=lambda x: x[0] * x[1])
        
        # Determine grid layout
        image_size = self.model.config.vision_config.image_size
        processed_images, (cols, rows) = dynamic_preprocess(
            image_pil, 
            target_ratios=target_ratios,
            image_size=image_size, 
            use_thumbnail=self.model.use_thumbnail
        )
        
        # If not using pruning, return all tiles
        if not use_pruning:
            return processed_images
        
        # Otherwise, proceed with token pruning
        # 1. Get Attention Map on the global image (thumbnail)
        thumbnail = image_pil.resize((image_size, image_size))
        
        I_list = [self.model.transformer(thumbnail)]
        I = torch.stack(I_list).to(self.device).to(self.model.dtype)
        
        heatmap = self._get_gradient_weighted_attention_map(I, prompt)
        
        # 2. Resize heatmap to (rows, cols) directly
        # Use area interpolation for downsampling from tokens to grid
        hm_grid = F.interpolate(heatmap, size=(rows, cols), mode='area') 
        hm_grid = hm_grid.squeeze() # (rows, cols)
        
        if hm_grid.ndim == 0:
            hm_grid = hm_grid.view(1, 1)
        elif hm_grid.ndim == 1:
            hm_grid = hm_grid.view(rows, cols)

        # Normalize
        hm_min = hm_grid.min()
        hm_max = hm_grid.max()
        if hm_max > hm_min:
            hm_norm = (hm_grid - hm_min) / (hm_max - hm_min)
        else:
            hm_norm = torch.zeros_like(hm_grid)
            
        # 3. Select tiles using vectorized operations
        
        # Condition 1: High attention value
        mask1 = hm_norm > threshold
        
        # Condition 2: Local peak
        # Use convolution to calculate neighbor averages
        # Kernel: 3x3 ones with center 0
        kernel = torch.ones(1, 1, 3, 3, device=self.device, dtype=hm_norm.dtype)
        kernel[0, 0, 1, 1] = 0
        
        hm_input = hm_norm.unsqueeze(0).unsqueeze(0) # (1, 1, rows, cols)
        
        # Sum of neighbors
        neighbor_sum = F.conv2d(hm_input, kernel, padding=1)
        
        # Count of valid neighbors (to handle edges)
        ones = torch.ones_like(hm_input)
        neighbor_count = F.conv2d(ones, kernel, padding=1)
        
        avg_neighbor = neighbor_sum / (neighbor_count + 1e-8)
        avg_neighbor = avg_neighbor.squeeze()
        
        if avg_neighbor.ndim == 0: # Handle 1x1 case
             avg_neighbor = avg_neighbor.view(1, 1)
        
        mask2 = (hm_norm > (avg_neighbor * 1.2)) & (hm_norm > hm_norm.mean())
        
        final_mask = mask1 | mask2
        
        # Get indices
        flat_mask = final_mask.flatten()
        selected_indices = torch.nonzero(flat_mask).squeeze(1).tolist()
        
        if isinstance(selected_indices, int):
            selected_indices = [selected_indices]
        
        # If no tiles selected, select max
        if not selected_indices:
            max_idx = torch.argmax(hm_grid.flatten()).item()
            selected_indices.append(max_idx)
        
        final_images = [processed_images[idx] for idx in selected_indices]
            
        has_thumbnail = self.model.use_thumbnail and len(processed_images) > rows * cols
        
        if has_thumbnail:
            final_images.append(processed_images[-1])
            
        return final_images