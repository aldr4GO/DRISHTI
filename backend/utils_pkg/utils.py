import numpy as np
import base64
from PIL import Image
import io

def mask_to_base64(mask: np.ndarray) -> str:
    # mask is likely a 2D numpy array (0/1 or 0-255)
    # Convert to PIL Image
    try:
        # Ensure mask is 2D
        if mask.ndim == 3:
            if mask.shape[2] == 1:
                mask = mask[:, :, 0]
            elif mask.shape[0] == 1:
                mask = mask[0]
            else:
                # Convert RGB to grayscale
                mask = np.mean(mask, axis=2)
        
        if mask.dtype == bool:
            mask = (mask * 255).astype(np.uint8)
        elif mask.max() <= 1:
            mask = (mask * 255).astype(np.uint8)
        else:
            mask = mask.astype(np.uint8)
        
        img = Image.fromarray(mask)
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode("utf-8")
    except Exception as e:
        print(f"Error encoding mask: {e}")
        return ""

def get_cleaned_obbs(mask):
    import cv2
    
    # Ensure mask is 2D - if 3D, take first channel or convert to grayscale
    if mask.ndim == 3:
        if mask.shape[2] == 1:
            mask = mask[:, :, 0]
        elif mask.shape[0] == 1:
            mask = mask[0]
        else:
            # Convert RGB to grayscale
            mask = np.mean(mask, axis=2)
    
    # Ensure mask is uint8
    if mask.dtype == bool:
        mask = (mask * 255).astype(np.uint8)
    elif mask.max() <= 1:
        mask = (mask * 255).astype(np.uint8)
    else:
        mask = mask.astype(np.uint8)

    # Get image dimensions for normalization
    height, width = mask.shape[:2]
    
    # Check if mask is empty
    if cv2.countNonZero(mask) == 0:
        return []

    # Use watershed to separate touching objects
    # 1. Noise removal
    kernel = np.ones((3,3), np.uint8)
    opening = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
    
    # 2. Sure background area
    sure_bg = cv2.dilate(opening, kernel, iterations=3)

    # 3. Finding sure foreground area
    dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    if dist_transform.max() == 0:
        return []
    ret, sure_fg = cv2.threshold(dist_transform, 0.2 * dist_transform.max(), 255, 0)

    # 4. Finding unknown region
    sure_fg = np.uint8(sure_fg)
    unknown = cv2.subtract(sure_bg, sure_fg)

    # 5. Marker labelling
    ret, markers = cv2.connectedComponents(sure_fg)

    # Add one to all labels so that sure background is not 0, but 1
    markers = markers + 1

    # Now, mark the region of unknown with zero
    markers[unknown == 255] = 0

    # 6. Apply Watershed
    # Watershed expects a 3-channel image
    img_for_watershed = cv2.cvtColor(opening, cv2.COLOR_GRAY2BGR)
    markers = cv2.watershed(img_for_watershed, markers)

    # Collect contours from separated objects
    valid_contours = []
    unique_labels = np.unique(markers)
    
    for label in unique_labels:
        if label <= 1: # 0 is unknown/boundary, 1 is background
            continue
            
        # Create mask for this object
        obj_mask = np.zeros_like(mask, dtype=np.uint8)
        obj_mask[markers == label] = 255
        
        contours, _ = cv2.findContours(obj_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            c = max(contours, key=cv2.contourArea)
            valid_contours.append(c)

    if not valid_contours:
        return []

    areas = [cv2.contourArea(c) for c in valid_contours]
    if not areas:
        return []

    mean_area = np.mean(areas)
    threshold = 0.25 * mean_area

    obbs = []
    for c, area in zip(valid_contours, areas):
        if area >= threshold:
            rect = cv2.minAreaRect(c)
            box = cv2.boxPoints(rect)
            # Normalize coordinates: x by width, y by height
            # Format: (x1, y1, x2, y2, x3, y3, x4, y4)
            normalized_box = []
            for point in box:
                normalized_box.append(float(point[0] / width))   # x-coordinate
                normalized_box.append(float(point[1] / height))  # y-coordinate
            obbs.append(normalized_box)
    return obbs

def get_seg_hidden_states(hidden_states, output_ids, seg_id):
    seg_mask = output_ids == seg_id
    n_out = len(seg_mask)
    if n_out == 0:
        return hidden_states[0:0]
    return hidden_states[-n_out:][seg_mask]


def calculate_area_from_mask(mask: np.ndarray, gsd: float) -> float:
    """
    Calculate the area of the largest contour in a segmentation mask.
    
    Args:
        mask: 2D or 3D numpy array representing the segmentation mask
        gsd: Ground Sample Distance in meters (spatial resolution)
        
    Returns:
        Area in square meters (pixel count * gsd^2)
    """
    import cv2
    
    # Ensure mask is 2D
    if mask.ndim == 3:
        if mask.shape[2] == 1:
            mask = mask[:, :, 0]
        elif mask.shape[0] == 1:
            mask = mask[0]
        else:
            # Convert RGB to grayscale
            mask = np.mean(mask, axis=2)
    
    # Ensure mask is uint8
    if mask.dtype == bool:
        mask = (mask * 255).astype(np.uint8)
    elif mask.max() <= 1:
        mask = (mask * 255).astype(np.uint8)
    else:
        mask = mask.astype(np.uint8)
    
    # Check if mask is empty
    if cv2.countNonZero(mask) == 0:
        return 0.0
    
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return 0.0
    
    # Find the largest contour
    largest_contour = max(contours, key=cv2.contourArea)
    
    # Create a mask for the largest contour to count pixels
    contour_mask = np.zeros_like(mask, dtype=np.uint8)
    cv2.drawContours(contour_mask, [largest_contour], -1, 255, thickness=cv2.FILLED)
    
    # Count pixels in the largest contour
    pixel_count = cv2.countNonZero(contour_mask)
    
    # Calculate area: pixel_count * gsd^2
    area = pixel_count * (gsd ** 2)
    
    return area