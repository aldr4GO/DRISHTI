'use client';

import { useEffect, useRef, useState } from 'react';
import { BoundingBox, RegionSelection } from '@/types/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ImagePanelProps {
  imageUrl: string | null;
  boundingBoxes: BoundingBox[];
  caption?: string;
  isCaptionLoading?: boolean;
  selectedObjectId?: string | null;
  onObjectSelect?: (objectId: string | null) => void;
  maskUrl?: string | null;
  isRegionSelectMode?: boolean;
  regionSelection?: RegionSelection | null;
  onRegionSelect?: (region: RegionSelection | null) => void;
  onClearOverlays?: () => void;
  onImageUpload?: (file: File) => void;
  gsd?: number | null;
  onOpenSidebar?: () => void;
  onOpenChatbot?: () => void;
}

export default function ImagePanel({ imageUrl, boundingBoxes, caption, isCaptionLoading, selectedObjectId, onObjectSelect, maskUrl, isRegionSelectMode, regionSelection, onRegionSelect, onClearOverlays, onImageUpload, gsd, onOpenSidebar, onOpenChatbot }: ImagePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpload) {
      onImageUpload(file);
    }
    // Reset input so same file can be selected again
    if (e.target) {
      e.target.value = '';
    }
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const maskRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [maskLoaded, setMaskLoaded] = useState(false);
  const [hoveredBox, setHoveredBox] = useState<string | null>(null);
  const [blinkOpacity, setBlinkOpacity] = useState(0.4);
  
  // Pan and zoom states
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  // Region drawing states
  const [isDrawingRegion, setIsDrawingRegion] = useState(false);
  const [regionStart, setRegionStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRegion, setCurrentRegion] = useState<RegionSelection | null>(null);
  
  // Ruler visibility state
  const [showRulers, setShowRulers] = useState<boolean>(true);
  
  // Touch gesture states
  const [touchStartDistance, setTouchStartDistance] = useState<number>(0);
  const [touchStartScale, setTouchStartScale] = useState<number>(1);

  useEffect(() => {
    if (imageUrl && imageRef.current) {
      const img = imageRef.current;
      img.src = imageUrl;
      img.onload = () => {
        setImageLoaded(true);
        // Reset transform on new image
        setScale(1);
        setTranslateX(0);
        setTranslateY(0);
      };
    }
  }, [imageUrl]);

  // Segmentation mask loading removed - using filled bounding boxes instead
  useEffect(() => {
    setMaskLoaded(false); // Always set to false, mask not used anymore
  }, [maskUrl]);

  // Auto-zoom to bounding boxes when they appear (disabled for localization)
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current || !containerRef.current || boundingBoxes.length === 0) return;
    
    // Don't auto-zoom when localization mask is present - keep full view
    if (maskUrl) {
      setScale(1);
      setTranslateX(0);
      setTranslateY(0);
      return;
    }
    
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    
    console.log('=== AUTO-ZOOM DEBUG ===');
    console.log('Canvas display size:', canvasRect.width, canvasRect.height);
    console.log('Canvas internal size:', canvas.width, canvas.height);
    console.log('Image natural size:', img.naturalWidth, img.naturalHeight);
    
    // Calculate bounding box that encompasses all detected objects (in image pixel coordinates)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    boundingBoxes.forEach((box) => {
      box.coordinates.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    });
    
    console.log('Detected region (image coords):', { minX, minY, maxX, maxY });
    
    // Add 120% padding for better visibility and ensure complete box is shown
    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;
    const padding = Math.max(boxWidth, boxHeight) * 1.2;
    
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(img.naturalWidth, maxX + padding);
    maxY = Math.min(img.naturalHeight, maxY + padding);
    
    const paddedWidth = maxX - minX;
    const paddedHeight = maxY - minY;
    
    // Center of detected region in IMAGE PIXELS
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    console.log('Region center (image coords):', centerX, centerY);
    console.log('Padded size (image coords):', paddedWidth, paddedHeight);
    
    // Calculate the display scale factor (how much canvas shrinks the image to fit)
    const displayScale = Math.min(
      canvasRect.width / img.naturalWidth,
      canvasRect.height / img.naturalHeight
    );
    
    console.log('Display scale factor:', displayScale);
    
    // Now convert to display coordinates
    const centerXDisplay = centerX * displayScale;
    const centerYDisplay = centerY * displayScale;
    const paddedWidthDisplay = paddedWidth * displayScale;
    const paddedHeightDisplay = paddedHeight * displayScale;
    
    console.log('Region center (display coords):', centerXDisplay, centerYDisplay);
    console.log('Padded size (display coords):', paddedWidthDisplay, paddedHeightDisplay);
    
    // Calculate zoom to make the region fill 45% of viewport IN DISPLAY SPACE (reduced to show more area)
    const targetFillRatio = 0.45;
    const scaleX = (canvasRect.width * targetFillRatio) / paddedWidthDisplay;
    const scaleY = (canvasRect.height * targetFillRatio) / paddedHeightDisplay;
    
    let newScale = Math.min(scaleX, scaleY);
    newScale = Math.max(1.2, Math.min(newScale, 6));
    
    console.log('Calculated scale:', newScale);
    
    // IMPORTANT: Canvas internal size is 4096x4096, but displayed at 404x404
    // The ctx.translate() works in CANVAS INTERNAL coordinates (4096x4096)
    // But the scale factor affects DISPLAY coordinates
    // 
    // After transform:
    // - Point (x,y) in canvas coords becomes: translate + (x * scale) in canvas coords
    // - This is then displayed at: (translate + x*scale) * displayScale in screen
    //
    // We want: (translateX + centerX * scale) * displayScale = canvasRect.width / 2
    // So: translateX = (canvasRect.width / 2) / displayScale - centerX * scale
    
    const newTranslateX = (canvasRect.width / 2) / displayScale - centerX * newScale;
    const newTranslateY = (canvasRect.height / 2) / displayScale - centerY * newScale;
    
    console.log('Translation (in canvas internal coords):', newTranslateX, newTranslateY);
    console.log('Expected center after transform (canvas coords):', newTranslateX + centerX * newScale, newTranslateY + centerY * newScale);
    console.log('Expected center after transform (display px):', (newTranslateX + centerX * newScale) * displayScale, (newTranslateY + centerY * newScale) * displayScale);
    console.log('Target center (display px):', canvasRect.width / 2, canvasRect.height / 2);
    console.log('======================');
    
    // Apply zoom and pan
    setScale(newScale);
    setTranslateX(newTranslateX);
    setTranslateY(newTranslateY);
  }, [boundingBoxes, imageLoaded, maskUrl || '']);

  // Blinking animation for selected object - blinks 10 times then removes highlight
  useEffect(() => {
    if (!selectedObjectId) {
      setBlinkOpacity(0.4); // Reset to default
      return;
    }

    let animationFrame: number;
    let startTime = Date.now();
    const blinkDuration = 400; // Duration of one blink cycle (ms)
    const totalBlinks = 10;
    const totalDuration = blinkDuration * totalBlinks;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= totalDuration) {
        // Stop blinking after 5 cycles and remove highlight
        setBlinkOpacity(0.4);
        if (onObjectSelect) {
          onObjectSelect(null);
        }
        return;
      }
      
      // Create a smooth sine wave oscillation between 0.2 and 0.5
      const opacity = 0.35 + Math.sin(elapsed / blinkDuration) * 0.15;
      setBlinkOpacity(opacity);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [selectedObjectId, onObjectSelect]);
  
  // Function to draw rulers and border around the image
  const drawRulersAndBorder = (
    ctx: CanvasRenderingContext2D, 
    canvas: HTMLCanvasElement,
    imgWidth: number, 
    imgHeight: number, 
    currentScale: number, 
    currentTranslateX: number,
    currentTranslateY: number,
    gsdValue: number | null,
    isLightMode: boolean = false
  ) => {
    // Get the displayed image dimensions (in screen pixels)
    const canvasRect = canvas.getBoundingClientRect();
    const displayScale = Math.min(
      canvasRect.width / canvas.width,
      canvasRect.height / canvas.height
    );
    
    // Calculate displayed image size in screen pixels
    const displayedWidth = imgWidth * currentScale * displayScale;
    const displayedHeight = imgHeight * currentScale * displayScale;
    
    // Dynamic tick spacing based on displayed image size
    const sizeRatio = displayedWidth / imgWidth;
    const baseSpacing = 50; // base spacing in image pixels
    let tickSpacing = baseSpacing * sizeRatio;
    
    // Clamp tick spacing in screen pixels
    const minTickSpacing = 40;
    const maxTickSpacing = 150;
    const tickSpacingInScreen = tickSpacing * currentScale * displayScale;
    
    if (tickSpacingInScreen < minTickSpacing) {
      tickSpacing = minTickSpacing / (currentScale * displayScale);
    } else if (tickSpacingInScreen > maxTickSpacing) {
      tickSpacing = maxTickSpacing / (currentScale * displayScale);
    }
    
    // Round to nice numbers
    const magnitude = Math.pow(10, Math.floor(Math.log10(tickSpacing)));
    const normalized = tickSpacing / magnitude;
    let baseInterval;
    if (normalized < 2) baseInterval = magnitude;
    else if (normalized < 5) baseInterval = 2 * magnitude;
    else baseInterval = 5 * magnitude;
    
    // Calculate ruler dimensions - keep compact but visible
    const canvasSize = Math.max(canvas.width, canvas.height);
    const rulerScale = Math.max(1, canvasSize / 1000);
    
    // Calculate margin (same as in the drawing code)
    const rulerMargin = Math.max(60, Math.round(Math.max(imgWidth, imgHeight) / 20));
    
    const rulerThickness = Math.round(45 * rulerScale); // Ruler bar thickness
    const fontSize = Math.round(12 * rulerScale); // Font size
    const tickLength = Math.round(6 * rulerScale); // Minor tick length
    const majorTickLength = Math.round(12 * rulerScale); // Major tick length
    const borderWidth = Math.round(3 * rulerScale); // Border thickness (3px)
    const tickWidth = Math.round(2 * rulerScale); // Tick mark thickness (2px)
    
    // Calculate image bounds in canvas coordinates (accounting for margin)
    const imgCanvasLeft = currentTranslateX + rulerMargin;
    const imgCanvasTop = currentTranslateY + rulerMargin;
    const imgCanvasRight = currentTranslateX + rulerMargin + imgWidth * currentScale;
    const imgCanvasBottom = currentTranslateY + rulerMargin + imgHeight * currentScale;
    
    // Clamp to visible canvas area
    const visibleLeft = Math.max(rulerThickness, imgCanvasLeft);
    const visibleTop = Math.max(rulerThickness, imgCanvasTop);
    const visibleRight = Math.min(canvas.width, imgCanvasRight);
    const visibleBottom = Math.min(canvas.height, imgCanvasBottom);
    
    // Light mode vs dark mode colors
    const borderColor = isLightMode ? '#0E8275' : '#2ED1C7';
    const rulerBgColor = isLightMode ? 'rgba(249, 250, 251, 0.95)' : 'rgba(0, 0, 0, 0.85)';
    const tickColor = isLightMode ? '#0E8275' : '#2ED1C7';
    const textColor = isLightMode ? '#0A3F3A' : '#2ED1C7';
    
    // Draw border rectangle around the image (just outside visible bounds)
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.globalAlpha = isLightMode ? 0.85 : 1;
    ctx.strokeRect(
      visibleLeft,
      visibleTop,
      visibleRight - visibleLeft,
      visibleBottom - visibleTop
    );
    ctx.globalAlpha = 1;
    
    // Draw top ruler bar (horizontal) - transparent in light mode
    ctx.fillStyle = rulerBgColor;
    ctx.fillRect(rulerThickness, 0, canvas.width - rulerThickness, rulerThickness);
    
    // Draw horizontal ticks and labels
    ctx.strokeStyle = tickColor;
    ctx.fillStyle = textColor;
    ctx.lineWidth = tickWidth;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = isLightMode ? 0.85 : 1;
    
    const startXTick = Math.floor(-(currentTranslateX + rulerMargin) / currentScale / baseInterval) * baseInterval;
    const endXTick = Math.ceil((canvas.width - currentTranslateX - rulerMargin) / currentScale / baseInterval) * baseInterval;
    
    for (let x = startXTick; x <= endXTick; x += baseInterval) {
      if (x < 0 || x > imgWidth) continue;
      const screenX = currentTranslateX + rulerMargin + x * currentScale;
      if (screenX < rulerThickness || screenX > canvas.width) continue;
      
      const isMajor = x % (baseInterval * 2) === 0;
      const tickLen = isMajor ? majorTickLength : tickLength;
      
      // Draw tick mark pointing down from ruler
      ctx.beginPath();
      ctx.moveTo(screenX, rulerThickness);
      ctx.lineTo(screenX, rulerThickness - tickLen);
      ctx.stroke();
      
      // Draw label on major ticks
      if (isMajor) {
        const label = gsdValue ? `${(x * gsdValue).toFixed(1)}m` : `${Math.round(x)}`;
        ctx.fillText(label, screenX, rulerThickness / 2);
      }
    }
    
    ctx.globalAlpha = 1;
    
    // Draw left ruler bar (vertical)
    ctx.fillStyle = rulerBgColor;
    ctx.fillRect(0, rulerThickness, rulerThickness, canvas.height - rulerThickness);
    
    // Draw vertical ticks and labels
    ctx.strokeStyle = tickColor;
    ctx.fillStyle = textColor;
    ctx.lineWidth = tickWidth;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = isLightMode ? 0.85 : 1;
    
    const startYTick = Math.floor(-(currentTranslateY + rulerMargin) / currentScale / baseInterval) * baseInterval;
    const endYTick = Math.ceil((canvas.height - currentTranslateY - rulerMargin) / currentScale / baseInterval) * baseInterval;
    
    for (let y = startYTick; y <= endYTick; y += baseInterval) {
      if (y < 0 || y > imgHeight) continue;
      const screenY = currentTranslateY + rulerMargin + y * currentScale;
      if (screenY < rulerThickness || screenY > canvas.height) continue;
      
      const isMajor = y % (baseInterval * 2) === 0;
      const tickLen = isMajor ? majorTickLength : tickLength;
      
      // Draw tick mark pointing left from ruler
      ctx.beginPath();
      ctx.moveTo(rulerThickness, screenY);
      ctx.lineTo(rulerThickness - tickLen, screenY);
      ctx.stroke();
      
      // Draw label on major ticks (rotated)
      if (isMajor) {
        const label = gsdValue ? `${(y * gsdValue).toFixed(1)}m` : `${Math.round(y)}`;
        ctx.save();
        ctx.translate(rulerThickness / 2, screenY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }
    
    ctx.globalAlpha = 1;
    
    // Draw corner square where rulers meet
    ctx.fillStyle = rulerBgColor;
    ctx.fillRect(0, 0, rulerThickness, rulerThickness);
  };

  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    
    // Add margin around image for rulers - calculate based on image size
    const rulerMargin = Math.max(60, Math.round(Math.max(img.naturalWidth, img.naturalHeight) / 20));
    
    canvas.width = img.naturalWidth + rulerMargin * 2;
    canvas.height = img.naturalHeight + rulerMargin * 2;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply transformations - order matters!
    // Canvas uses CSS pixels for display, but naturalWidth/Height for internal size
    ctx.save();
    // Add margin offset so image is centered with space for rulers
    ctx.translate(translateX + rulerMargin, translateY + rulerMargin);
    ctx.scale(scale, scale);
    
    ctx.drawImage(img, 0, 0);
    
    // Segmentation mask removed - using filled bounding boxes instead

    // Pastel color palette for different objects
    const pastelColors = [
      { stroke: '#60a5fa', fill: 'rgba(96, 165, 250, 0.3)', label: '#3b82f6' },  // blue
      { stroke: '#34d399', fill: 'rgba(52, 211, 153, 0.3)', label: '#10b981' },  // green
      { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.3)', label: '#d97706' },  // amber
      { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.3)', label: '#db2777' },  // pink
      { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.3)', label: '#7c3aed' },  // violet
      { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.3)', label: '#0891b2' },   // cyan
      { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.3)', label: '#ea580c' },  // orange
      { stroke: '#14b8a6', fill: 'rgba(20, 184, 166, 0.3)', label: '#0d9488' },  // teal
      { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.3)', label: '#9333ea' },  // purple
      { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.3)', label: '#dc2626' },   // red
    ];
    
    // Helper function to get color for an object
    const getObjectColor = (index: number) => {
      return pastelColors[index % pastelColors.length];
    };
    
    // Store labels to draw after restore (for consistent sizing)
    const labelsToDrawAfterRestore: Array<{x: number, y: number, text: string, color: string, textColor: string}> = [];
    let regionLabelToDrawAfterRestore: {x: number, y: number, text: string} | null = null;

    // Draw bounding boxes
    boundingBoxes.forEach((box, index) => {
      const coords = box.coordinates;
      if (coords.length < 2) return;

      const isSelected = selectedObjectId === box.object_id;
      const isHovered = hoveredBox === box.object_id;
      const objectColor = getObjectColor(index);

      ctx.beginPath();
      ctx.moveTo(coords[0][0], coords[0][1]);
      
      for (let i = 1; i < coords.length; i++) {
        ctx.lineTo(coords[i][0], coords[i][1]);
      }
      ctx.closePath();

      // Fill all bounding boxes with light opaque color
      if (isSelected) {
        // Selected object: blinking purple fill
        ctx.fillStyle = `rgba(168, 85, 247, ${blinkOpacity})`; // purple with animated opacity
        ctx.fill();
      } else {
        // Non-selected objects: light opaque fill matching the object's color
        ctx.fillStyle = objectColor.fill; // Already has rgba with 0.3 opacity
        ctx.fill();
      }

      // Highlight selected object with purple, otherwise use object's unique color
      if (isSelected) {
        ctx.strokeStyle = '#a855f7'; // accent-purple
        ctx.lineWidth = 5 / scale;
        // Add glow effect for selected object
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 15 / scale;
      } else if (isHovered) {
        ctx.strokeStyle = objectColor.stroke;
        ctx.lineWidth = 4 / scale;
      } else {
        ctx.strokeStyle = objectColor.stroke;
        ctx.lineWidth = 3 / scale;
      }
      
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      const centerX = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
      const centerY = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;

      // Store label info for drawing after restore (in screen space)
      // We'll draw labels outside the transform to keep them consistent size
      labelsToDrawAfterRestore.push({
        x: centerX,
        y: centerY,
        text: box.object_id,
        color: isSelected ? '#a855f7' : objectColor.label,
        textColor: isSelected ? '#ffffff' : '#000000'
      });
    });
    
      // Draw region selection rectangle (in image coordinates, so it transforms with image)
    const activeRegion = currentRegion || regionSelection;
    if (activeRegion && isRegionSelectMode) {
      // Calculate dynamic scaling for region UI elements based on zoom
      // Use inverse scale so elements stay consistent size visually
      const uiScale = 1 / scale;
      const minScale = 0.5; // Don't make elements too small
      const maxScale = 3; // Don't make elements too large
      const clampedUiScale = Math.min(Math.max(uiScale, minScale), maxScale);
      
      const lineWidth = 2.5 * clampedUiScale;
      const dashLength = 10 * clampedUiScale;
      const dashGap = 5 * clampedUiScale;
      const handleSize = 10 * clampedUiScale;
      
      // Darker orange for better visibility
      ctx.strokeStyle = '#CC7A00';
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([dashLength, dashGap]);
      ctx.strokeRect(activeRegion.x, activeRegion.y, activeRegion.width, activeRegion.height);
      ctx.setLineDash([]);
      
      // Fill with stronger semi-transparent orange
      ctx.fillStyle = 'rgba(204, 122, 0, 0.25)';
      ctx.fillRect(activeRegion.x, activeRegion.y, activeRegion.width, activeRegion.height);
      
      // Draw corner handles (rounded squares) - darker orange
      ctx.fillStyle = '#CC7A00';
      const corners = [
        { x: activeRegion.x, y: activeRegion.y },
        { x: activeRegion.x + activeRegion.width, y: activeRegion.y },
        { x: activeRegion.x, y: activeRegion.y + activeRegion.height },
        { x: activeRegion.x + activeRegion.width, y: activeRegion.y + activeRegion.height },
      ];
      corners.forEach(corner => {
        // Draw rounded corner handles
        const radius = handleSize / 4;
        ctx.beginPath();
        ctx.moveTo(corner.x - handleSize / 2 + radius, corner.y - handleSize / 2);
        ctx.lineTo(corner.x + handleSize / 2 - radius, corner.y - handleSize / 2);
        ctx.quadraticCurveTo(corner.x + handleSize / 2, corner.y - handleSize / 2, corner.x + handleSize / 2, corner.y - handleSize / 2 + radius);
        ctx.lineTo(corner.x + handleSize / 2, corner.y + handleSize / 2 - radius);
        ctx.quadraticCurveTo(corner.x + handleSize / 2, corner.y + handleSize / 2, corner.x + handleSize / 2 - radius, corner.y + handleSize / 2);
        ctx.lineTo(corner.x - handleSize / 2 + radius, corner.y + handleSize / 2);
        ctx.quadraticCurveTo(corner.x - handleSize / 2, corner.y + handleSize / 2, corner.x - handleSize / 2, corner.y + handleSize / 2 - radius);
        ctx.lineTo(corner.x - handleSize / 2, corner.y - handleSize / 2 + radius);
        ctx.quadraticCurveTo(corner.x - handleSize / 2, corner.y - handleSize / 2, corner.x - handleSize / 2 + radius, corner.y - handleSize / 2);
        ctx.closePath();
        ctx.fill();
      });
      
      // Store region label info for drawing after restore (in screen space)
      regionLabelToDrawAfterRestore = {
        x: activeRegion.x + activeRegion.width / 2,
        y: activeRegion.y,
        text: 'Selected Region'
      };
    }
    
    ctx.restore();
    
    // Calculate dynamic scaling for labels based on IMAGE RESOLUTION (not zoom level)
    // This ensures labels scale with image size, not with how much we zoom
    const referenceSize = 512; // Images around 512px get base font size
    const imageSizeForScaling = Math.max(img.naturalWidth, img.naturalHeight);
    const resolutionScaleFactor = imageSizeForScaling / referenceSize;
    
    // Clamp the resolution scale factor to reasonable bounds
    // Small images (256px): factor = 0.5, Large images (4096px): factor = 8
    const clampedResolutionFactor = Math.max(1.0, Math.min(resolutionScaleFactor, 5));
    
    // Also consider current zoom to keep labels readable
    // At very high zoom (scale > 3), slightly increase label size
    // At very low zoom (scale < 0.5), slightly decrease label size
    const zoomAdjustment = Math.max(0.9, Math.min(scale, 2.5));
    
    // Final scale factor combines resolution and zoom
    const finalScaleFactor = clampedResolutionFactor * Math.sqrt(zoomAdjustment);
    
    // Clamp helper function
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    
    // Draw bounding box labels with dynamic sizing
    labelsToDrawAfterRestore.forEach((labelInfo) => {
      const screenX = translateX + rulerMargin + labelInfo.x * scale;
      const screenY = translateY + rulerMargin + labelInfo.y * scale;
      
      // Dynamic sizing for object labels
      const baseFontSize = 16;
      const fontSize = clamp(baseFontSize * finalScaleFactor, 16, 48);
      const padding = clamp(10 * finalScaleFactor, 10, 30);
      const boxHeight = clamp(24 * finalScaleFactor, 24, 72);
      const yOffset = clamp(28 * finalScaleFactor, 28, 84);
      
      ctx.fillStyle = labelInfo.color;
      ctx.font = `600 ${fontSize}px Inter, sans-serif`;
      const metrics = ctx.measureText(labelInfo.text);
      
      ctx.fillRect(
        screenX - metrics.width / 2 - padding,
        screenY - yOffset,
        metrics.width + padding * 2,
        boxHeight
      );
      
      ctx.fillStyle = labelInfo.textColor;
      ctx.fillText(labelInfo.text, screenX - metrics.width / 2, screenY - yOffset + boxHeight / 2 + fontSize / 3);
    });
    
    // Draw region label with dynamic sizing (larger than object labels)
    if (regionLabelToDrawAfterRestore) {
      const labelInfo = regionLabelToDrawAfterRestore;
      const screenX = translateX + rulerMargin + labelInfo.x * scale;
      const screenY = translateY + rulerMargin + labelInfo.y * scale;
      
      // Dynamic sizing for region label (larger base size)
      const baseFontSize = 22;
      const fontSize = clamp(baseFontSize * finalScaleFactor, 22, 66);
      const padding = clamp(14 * finalScaleFactor, 14, 42);
      const boxHeight = clamp(32 * finalScaleFactor, 32, 96);
      const yOffset = clamp(42 * finalScaleFactor, 42, 126);
      const borderRadius = clamp(10 * finalScaleFactor, 10, 30);
      
      // Darker orange background for region label
      ctx.fillStyle = '#CC7A00';
      ctx.font = `600 ${fontSize}px Inter, sans-serif`;
      const metrics = ctx.measureText(labelInfo.text);
      
      // Draw rounded rectangle for region label
      const rectX = screenX - metrics.width / 2 - padding;
      const rectY = screenY - yOffset;
      const rectWidth = metrics.width + padding * 2;
      const rectHeight = boxHeight;
      
      ctx.beginPath();
      ctx.moveTo(rectX + borderRadius, rectY);
      ctx.lineTo(rectX + rectWidth - borderRadius, rectY);
      ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + borderRadius);
      ctx.lineTo(rectX + rectWidth, rectY + rectHeight - borderRadius);
      ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - borderRadius, rectY + rectHeight);
      ctx.lineTo(rectX + borderRadius, rectY + rectHeight);
      ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - borderRadius);
      ctx.lineTo(rectX, rectY + borderRadius);
      ctx.quadraticCurveTo(rectX, rectY, rectX + borderRadius, rectY);
      ctx.closePath();
      ctx.fill();
      
      // White text on darker orange background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelInfo.text, screenX - metrics.width / 2, screenY - yOffset + boxHeight / 2 + fontSize / 3);
    }
    
    // Draw rulers and border in viewport coordinates (after restore, so they stay fixed)
    if (showRulers) {
      // Detect light mode
      const isLightMode = document.documentElement.classList.contains('light-mode');
      drawRulersAndBorder(ctx, canvas, img.naturalWidth, img.naturalHeight, scale, translateX, translateY, gsd || null, isLightMode);
    }
  }, [imageLoaded, boundingBoxes, hoveredBox, scale, translateX, translateY, selectedObjectId, blinkOpacity, maskLoaded, gsd, showRulers, isRegionSelectMode, regionSelection, currentRegion]);

  // Helper function to constrain pan values within boundaries
  const constrainPan = (newTranslateX: number, newTranslateY: number, currentScale: number) => {
    if (!canvasRef.current || !imageRef.current) return { x: newTranslateX, y: newTranslateY };
    
    // At 100% scale, always reset to 0,0 to show the image properly centered
    if (currentScale === 1) {
      return { x: 0, y: 0 };
    }
    
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Account for margin added to canvas
    const rulerMargin = Math.max(60, Math.round(Math.max(img.naturalWidth, img.naturalHeight) / 20));
    
    // Calculate the display scale (how much the canvas shrinks to fit display)
    const displayScale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height
    );
    
    // Calculate the scaled image dimensions in display coordinates
    const scaledWidth = img.naturalWidth * displayScale * currentScale;
    const scaledHeight = img.naturalHeight * displayScale * currentScale;
    
    // If image is smaller than viewport after scaling, center it
    if (scaledWidth <= rect.width) {
      newTranslateX = (rect.width / displayScale - img.naturalWidth * currentScale) / 2 - rulerMargin;
    } else {
      // Constrain horizontal panning: left edge and right edge
      const minTranslateX = (rect.width - scaledWidth) / displayScale - rulerMargin;
      const maxTranslateX = -rulerMargin;
      newTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, newTranslateX));
    }
    
    if (scaledHeight <= rect.height) {
      newTranslateY = (rect.height / displayScale - img.naturalHeight * currentScale) / 2 - rulerMargin;
    } else {
      // Constrain vertical panning: top edge and bottom edge
      const minTranslateY = (rect.height - scaledHeight) / displayScale - rulerMargin;
      const maxTranslateY = -rulerMargin;
      newTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, newTranslateY));
    }
    
    return { x: newTranslateX, y: newTranslateY };
  };

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const rect = canvas.getBoundingClientRect();
    
    // Account for margin
    const rulerMargin = Math.max(60, Math.round(Math.max(img.naturalWidth, img.naturalHeight) / 20));
    
    // Calculate display scale
    const displayScale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height
    );
    
    // Mouse position in display coordinates
    const mouseXDisplay = e.clientX - rect.left;
    const mouseYDisplay = e.clientY - rect.top;
    
    // Convert mouse position to canvas coordinates (accounting for margin)
    const mouseXCanvas = mouseXDisplay / displayScale - rulerMargin;
    const mouseYCanvas = mouseYDisplay / displayScale - rulerMargin;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(1, scale * zoomFactor), 10);

    // Zoom toward mouse position in canvas coordinates
    const scaleChange = newScale / scale;
    const newTranslateX = mouseXCanvas - (mouseXCanvas - translateX) * scaleChange;
    const newTranslateY = mouseYCanvas - (mouseYCanvas - translateY) * scaleChange;
    
    // Apply boundary constraints
    const constrained = constrainPan(newTranslateX, newTranslateY, newScale);
    setTranslateX(constrained.x);
    setTranslateY(constrained.y);
    setScale(newScale);
  };

  // Helper function to convert mouse position to image coordinates
  const mouseToImageCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    if (!canvasRef.current || !imageRef.current) return null;
    
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Account for margin
    const rulerMargin = Math.max(60, Math.round(Math.max(img.naturalWidth, img.naturalHeight) / 20));
    
    // Calculate display scale
    const displayScale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height
    );
    
    // Mouse position in display coordinates
    const mouseXDisplay = e.clientX - rect.left;
    const mouseYDisplay = e.clientY - rect.top;
    
    // Convert to canvas internal coordinates (accounting for margin)
    const mouseXCanvas = mouseXDisplay / displayScale - rulerMargin;
    const mouseYCanvas = mouseYDisplay / displayScale - rulerMargin;
    
    // Convert to image coordinates (accounting for pan and zoom)
    const imageX = (mouseXCanvas - translateX) / scale;
    const imageY = (mouseYCanvas - translateY) / scale;
    
    return { x: imageX, y: imageY };
  };

  // Handle mouse down for panning or region drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate display scale
    const displayScale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height
    );
    
    // If in region select mode, start drawing region
    if (isRegionSelectMode) {
      const coords = mouseToImageCoords(e);
      if (coords) {
        setIsDrawingRegion(true);
        setRegionStart(coords);
        setCurrentRegion(null);
        // Clear any previous selection when starting a new one
        if (onRegionSelect) {
          onRegionSelect(null);
        }
      }
      return;
    }
    
    setIsPanning(true);
    // Store starting position accounting for display scale
    setStartPos({ 
      x: e.clientX - translateX * displayScale, 
      y: e.clientY - translateY * displayScale 
    });
  };

  // Handle mouse move for panning or region drawing
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle region drawing
    if (isDrawingRegion && regionStart && isRegionSelectMode) {
      const coords = mouseToImageCoords(e);
      if (coords && imageRef.current) {
        const img = imageRef.current;
        // Calculate region bounds (handle drawing in any direction)
        const x = Math.max(0, Math.min(regionStart.x, coords.x));
        const y = Math.max(0, Math.min(regionStart.y, coords.y));
        const width = Math.min(img.naturalWidth - x, Math.abs(coords.x - regionStart.x));
        const height = Math.min(img.naturalHeight - y, Math.abs(coords.y - regionStart.y));
        
        setCurrentRegion({ x, y, width, height });
      }
      return;
    }
    
    if (!isPanning || !canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate display scale
    const displayScale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height
    );
    
    // Convert mouse movement from display coords to canvas coords
    const newTranslateX = (e.clientX - startPos.x) / displayScale;
    const newTranslateY = (e.clientY - startPos.y) / displayScale;
    
    // Apply boundary constraints
    const constrained = constrainPan(newTranslateX, newTranslateY, scale);
    setTranslateX(constrained.x);
    setTranslateY(constrained.y);
  };

  // Handle mouse up to stop panning or finish region drawing
  const handleMouseUp = () => {
    // Finish region drawing
    if (isDrawingRegion && currentRegion && isRegionSelectMode) {
      // Only accept regions with meaningful size (at least 10x10 pixels)
      if (currentRegion.width >= 10 && currentRegion.height >= 10) {
        if (onRegionSelect) {
          onRegionSelect(currentRegion);
        }
      } else {
        setCurrentRegion(null);
      }
      setIsDrawingRegion(false);
      setRegionStart(null);
      return;
    }
    
    setIsPanning(false);
  };
  
  // Clear region selection
  const handleClearRegion = () => {
    setCurrentRegion(null);
    if (onRegionSelect) {
      onRegionSelect(null);
    }
  };

  // Download image with overlays
  const handleDownloadWithOverlays = () => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) return;
    
    const img = imageRef.current;
    
    // Create a new canvas for the export (at original image resolution)
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = img.naturalWidth;
    exportCanvas.height = img.naturalHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;
    
    // Draw the original image
    ctx.drawImage(img, 0, 0);
    
    // Draw mask overlay if available
    // Segmentation mask removed - using filled bounding boxes instead
    
    // Pastel color palette for different objects
    const pastelColors = [
      { stroke: '#60a5fa', fill: 'rgba(96, 165, 250, 0.3)', label: '#3b82f6' },
      { stroke: '#34d399', fill: 'rgba(52, 211, 153, 0.3)', label: '#10b981' },
      { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.3)', label: '#d97706' },
      { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.3)', label: '#db2777' },
      { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.3)', label: '#7c3aed' },
      { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.3)', label: '#0891b2' },
      { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.3)', label: '#ea580c' },
      { stroke: '#14b8a6', fill: 'rgba(20, 184, 166, 0.3)', label: '#0d9488' },
      { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.3)', label: '#9333ea' },
      { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.3)', label: '#dc2626' },
    ];
    
    const getObjectColor = (index: number) => pastelColors[index % pastelColors.length];
    
    // Draw bounding boxes
    boundingBoxes.forEach((box, index) => {
      const coords = box.coordinates;
      if (coords.length < 2) return;
      
      const objectColor = getObjectColor(index);
      
      ctx.beginPath();
      ctx.moveTo(coords[0][0], coords[0][1]);
      for (let i = 1; i < coords.length; i++) {
        ctx.lineTo(coords[i][0], coords[i][1]);
      }
      ctx.closePath();
      
      ctx.strokeStyle = objectColor.stroke;
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Draw label
      const centerX = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
      const centerY = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
      
      ctx.fillStyle = objectColor.label;
      ctx.font = '600 14px Inter, sans-serif';
      const label = box.object_id;
      const metrics = ctx.measureText(label);
      const padding = 6;
      
      ctx.fillRect(
        centerX - metrics.width / 2 - padding,
        centerY - 20,
        metrics.width + padding * 2,
        22
      );
      
      ctx.fillStyle = '#000000';
      ctx.fillText(label, centerX - metrics.width / 2, centerY - 6);
    });
    
    // Create download link
    const link = document.createElement('a');
    link.download = `satellite-analysis-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  // Zoom in function
  const zoomIn = () => {
    const newScale = Math.min(scale * 1.2, 10);
    const constrained = constrainPan(translateX, translateY, newScale);
    setTranslateX(constrained.x);
    setTranslateY(constrained.y);
    setScale(newScale);
  };

  // Zoom out function
  const zoomOut = () => {
    const newScale = Math.max(scale / 1.2, 1);
    const constrained = constrainPan(translateX, translateY, newScale);
    setTranslateX(constrained.x);
    setTranslateY(constrained.y);
    setScale(newScale);
  };

  // Reset view
  const resetView = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };
  
  // Touch event handlers for mobile support
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };
  
  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length === 0) return { x: 0, y: 0 };
    if (touches.length === 1) return { x: touches[0].clientX, y: touches[0].clientY };
    
    const touch1 = touches[0];
    const touch2 = touches[1];
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  };
  
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const displayScale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height
    );
    
    if (e.touches.length === 2) {
      // Two-finger pinch-to-zoom
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      setTouchStartDistance(distance);
      setTouchStartScale(scale);
    } else if (e.touches.length === 1) {
      // Single-finger pan or region draw
      if (isRegionSelectMode) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const mouseEvent = {
          clientX: touch.clientX,
          clientY: touch.clientY,
        } as React.MouseEvent<HTMLCanvasElement>;
        const coords = mouseToImageCoords(mouseEvent as any);
        if (coords) {
          setIsDrawingRegion(true);
          setRegionStart(coords);
          setCurrentRegion(null);
          if (onRegionSelect) {
            onRegionSelect(null);
          }
        }
      } else {
        setIsPanning(true);
        setStartPos({
          x: e.touches[0].clientX - translateX * displayScale,
          y: e.touches[0].clientY - translateY * displayScale,
        });
      }
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const rect = canvas.getBoundingClientRect();
    const displayScale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height
    );
    
    if (e.touches.length === 2) {
      // Two-finger pinch-to-zoom
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      
      if (touchStartDistance > 0) {
        const scaleChange = distance / touchStartDistance;
        const newScale = Math.min(Math.max(1, touchStartScale * scaleChange), 10);
        
        // Convert center to canvas coords
        const centerXCanvas = (center.x - rect.left) / displayScale - (Math.max(60, Math.round(Math.max(img.naturalWidth, img.naturalHeight) / 20)));
        const centerYCanvas = (center.y - rect.top) / displayScale - (Math.max(60, Math.round(Math.max(img.naturalWidth, img.naturalHeight) / 20)));
        
        // Zoom toward center
        const scaleRatio = newScale / scale;
        const newTranslateX = centerXCanvas - (centerXCanvas - translateX) * scaleRatio;
        const newTranslateY = centerYCanvas - (centerYCanvas - translateY) * scaleRatio;
        
        const constrained = constrainPan(newTranslateX, newTranslateY, newScale);
        setTranslateX(constrained.x);
        setTranslateY(constrained.y);
        setScale(newScale);
      }
    } else if (e.touches.length === 1) {
      // Single-finger pan or region draw
      if (isDrawingRegion && regionStart && isRegionSelectMode) {
        const touch = e.touches[0];
        const mouseEvent = {
          clientX: touch.clientX,
          clientY: touch.clientY,
        } as React.MouseEvent<HTMLCanvasElement>;
        const coords = mouseToImageCoords(mouseEvent as any);
        if (coords && imageRef.current) {
          const img = imageRef.current;
          const x = Math.max(0, Math.min(regionStart.x, coords.x));
          const y = Math.max(0, Math.min(regionStart.y, coords.y));
          const width = Math.min(img.naturalWidth - x, Math.abs(coords.x - regionStart.x));
          const height = Math.min(img.naturalHeight - y, Math.abs(coords.y - regionStart.y));
          setCurrentRegion({ x, y, width, height });
        }
      } else if (isPanning) {
        const newTranslateX = (e.touches[0].clientX - startPos.x) / displayScale;
        const newTranslateY = (e.touches[0].clientY - startPos.y) / displayScale;
        
        const constrained = constrainPan(newTranslateX, newTranslateY, scale);
        setTranslateX(constrained.x);
        setTranslateY(constrained.y);
      }
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) {
      // All touches released
      if (isDrawingRegion && currentRegion && isRegionSelectMode) {
        if (currentRegion.width >= 10 && currentRegion.height >= 10) {
          if (onRegionSelect) {
            onRegionSelect(currentRegion);
          }
        } else {
          setCurrentRegion(null);
        }
        setIsDrawingRegion(false);
        setRegionStart(null);
      }
      
      setIsPanning(false);
      setTouchStartDistance(0);
      setTouchStartScale(1);
    } else if (e.touches.length === 1) {
      // One finger still touching (was two-finger pinch, now single touch)
      setTouchStartDistance(0);
      setTouchStartScale(1);
    }
  };

  return (
    <div className="flex-1 h-screen modern-panel flex flex-col overflow-hidden" style={{ borderRadius: 0 }}>
      {/* Header */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-border-subtle">
        <div className="flex items-center justify-between gap-2 mb-2">
          {/* Mobile Menu Buttons */}
          <div className="flex items-center gap-2">
            {onOpenSidebar && (
              <button
                onClick={onOpenSidebar}
                className="md:hidden p-2 hover:bg-elevated-bg rounded-lg transition-colors"
                aria-label="Open sidebar"
              >
                <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-text-primary">Image Analysis</h2>
            </div>
          </div>
          {onOpenChatbot && (
            <button
              onClick={onOpenChatbot}
              className="xl:hidden p-2 hover:bg-elevated-bg rounded-lg transition-colors"
              aria-label="Open chatbot"
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted truncate">DRISHTI — Deep Remote-sensing Intelligence System for Holistic Task Integration</p>
          </div>
          {imageUrl && (
            <div className="flex items-center gap-1 flex-wrap">
              <div className="status-badge status-badge-teal text-[10px] sm:text-xs">
                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Image Loaded</span>
                <span className="sm:hidden">Loaded</span>
              </div>
              {isRegionSelectMode && (
                <div className="status-badge text-[10px] sm:text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <span className="hidden sm:inline">Region Select</span>
                  <span className="sm:hidden">Region</span>
                </div>
              )}
              {(regionSelection || currentRegion) && isRegionSelectMode && (
                <button
                  onClick={handleClearRegion}
                  className="status-badge text-[10px] sm:text-xs bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors cursor-pointer"
                >
                  <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear
                </button>
              )}
              {boundingBoxes.length > 0 && (
                <div className="status-badge status-badge-purple text-[10px] sm:text-xs">
                  {boundingBoxes.length} <span className="hidden sm:inline">Objects</span>
                </div>
              )}
              {/* Download and Clear Overlay buttons - show when there are overlays */}
              {(boundingBoxes.length > 0 || maskUrl) && (
                <>
                  <button
                    onClick={handleDownloadWithOverlays}
                    className="hidden sm:flex status-badge text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                    title="Download image with overlays"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                  <button
                    onClick={onClearOverlays}
                    className="status-badge text-[10px] sm:text-xs bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors cursor-pointer"
                    title="Clear all overlays"
                  >
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="hidden sm:inline">Clear Overlays</span>
                    <span className="sm:hidden">Clear</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col relative bg-dark-bg justify-center">
        {imageUrl ? (
          <>
          {/* Zoom Controls - Fixed to main content area */}
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-20 flex flex-col gap-1 sm:gap-2">
            <button
              onClick={zoomIn}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-panel-bg border border-border-medium hover:border-accent-teal hover:bg-elevated-bg transition-all flex items-center justify-center group"
              title="Zoom In"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary group-hover:text-accent-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={zoomOut}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-panel-bg border border-border-medium hover:border-accent-teal hover:bg-elevated-bg transition-all flex items-center justify-center group"
              title="Zoom Out"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary group-hover:text-accent-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={resetView}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-panel-bg border border-border-medium hover:border-accent-teal hover:bg-elevated-bg transition-all flex items-center justify-center group"
              title="Reset View"
            >
              <svg className="w-5 h-5 text-text-secondary group-hover:text-accent-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-panel-bg border border-border-medium flex items-center justify-center">
              <span className="text-[10px] sm:text-xs font-semibold text-accent-teal">{Math.round(scale * 100)}%</span>
            </div>
            <button
              onClick={() => setShowRulers(!showRulers)}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg border transition-all flex items-center justify-center group ${
                showRulers 
                  ? 'bg-accent-teal border-accent-teal' 
                  : 'bg-panel-bg border-border-medium hover:border-accent-teal hover:bg-elevated-bg'
              }`}
              title={showRulers ? "Hide Rulers" : "Show Rulers"}
            >
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${showRulers ? 'text-white' : 'text-text-secondary group-hover:text-accent-teal'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h4M3 10h4M3 14h4M3 18h4" />
              </svg>
            </button>
          </div>
          

          
          {/* Image Area - Responsive height */}
          <div className="p-2 sm:p-4 flex items-center justify-center w-full h-[50vh] sm:h-[55vh] md:h-[60vh] lg:h-[65vh]" ref={containerRef}>
            {/* Image Display */}
            <div className="relative rounded-lg overflow-hidden border border-border-medium shadow-2xl w-full h-full flex items-center justify-center">
              <img ref={imageRef} alt="Satellite" className="hidden" />
              <img ref={maskRef} alt="Segmentation Mask" className="hidden" />
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full object-contain"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ 
                  cursor: isRegionSelectMode 
                    ? (isDrawingRegion ? 'crosshair' : 'crosshair')
                    : (isPanning ? 'grabbing' : 'grab'),
                  touchAction: 'none'
                }}
              />
            </div>
          </div>
          
          {/* Caption Section - Responsive height */}
          <div className="w-full border-t border-border-medium bg-panel-bg flex-shrink-0 h-[35vh] sm:h-[30vh] md:h-[28vh] lg:h-[25vh] max-h-[220px] min-h-[120px] sm:min-h-[150px]">
            <div className="px-6 py-3 border-b border-border-subtle bg-elevated-bg">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">Caption</h3>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto" style={{ height: 'calc(100% - 48px)' }}>
              {isCaptionLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3">
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 rounded-full bg-accent-teal animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-accent-teal animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-accent-teal animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <p className="text-sm text-text-secondary">Captions are loading...</p>
                  </div>
                </div>
              ) : caption ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({node, ...props}) => <p className="text-sm text-text-secondary leading-relaxed mb-2" {...props} />,
                      h1: ({node, ...props}) => <h1 className="text-lg font-bold text-text-primary mb-2 mt-4" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-base font-bold text-text-primary mb-2 mt-3" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-sm font-bold text-text-primary mb-1 mt-2" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-inside text-sm text-text-secondary mb-2 space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal list-inside text-sm text-text-secondary mb-2 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="text-sm text-text-secondary" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-semibold text-text-primary" {...props} />,
                      em: ({node, ...props}) => <em className="italic text-text-secondary" {...props} />,
                      code: ({node, ...props}: any) => 
                        props.inline 
                          ? <code className="px-1.5 py-0.5 bg-elevated-bg rounded text-xs text-accent-teal font-mono" {...props} />
                          : <code className="block px-3 py-2 bg-elevated-bg rounded text-xs text-accent-teal font-mono overflow-x-auto mb-2" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-accent-teal pl-4 italic text-text-muted text-sm mb-2" {...props} />,
                    }}
                  >
                    {caption}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-text-dim italic">Caption will appear here...</p>
                </div>
              )}
            </div>
          </div>
          </>
        ) : (
          <div className="text-center space-y-6">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <div 
              onClick={handleUploadClick}
              className="w-32 h-32 mx-auto rounded-2xl border-2 border-dashed border-border-medium bg-elevated-bg flex items-center justify-center cursor-pointer hover:border-accent-teal hover:bg-elevated-bg/80 transition-all duration-200 group"
            >
              <svg className="w-16 h-16 text-text-dim group-hover:text-accent-teal transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-text-primary mb-2">No image loaded</p>
              <p className="text-sm text-text-muted">Click to upload a satellite image to begin analysis</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
