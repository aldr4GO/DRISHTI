'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import ImagePanel from '@/components/ImagePanel';
import ChatbotPanel from '@/components/ChatbotPanel';
import { apiClient } from '@/lib/api';
import {
  ChatMessage,
  BoundingBox,
  SatelliteImageRequest,
  HistoryState,
  Session,
  RegionSelection,
} from '@/types/api';

export default function Home() {
  // Session management
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  
  // Current session state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  // Cache for original/upscaled image to send to model (base64)
  const [cachedImageBase64, setCachedImageBase64] = useState<string | null>(null);
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCaptionLoading, setIsCaptionLoading] = useState(false);
  
  // UI state
  const [darkMode, setDarkMode] = useState(true);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  
  // Region selection state
  const [isRegionSelectMode, setIsRegionSelectMode] = useState(false);
  const [regionSelection, setRegionSelection] = useState<RegionSelection | null>(null);
  
  // GSD (Ground Sample Distance) state - meters per pixel
  const [gsd, setGsd] = useState<number | null>(null);
  
  // SAR (Synthetic Aperture Radar) image toggle
  const [isSarMode, setIsSarMode] = useState(false);
  
  // Reference to image for region marking
  const imageRefForRegion = useRef<HTMLImageElement | null>(null);
  
  // History for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize first session and set up dark mode
  useEffect(() => {
    const initialSession: Session = {
      id: Date.now().toString(),
      name: 'Session 1',
      timestamp: new Date(),
      messages: [],
      boundingBoxes: [],
    };
    setSessions([initialSession]);
    setCurrentSessionId(initialSession.id);
    
    // Initialize dark mode class on document
    if (!darkMode) {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [darkMode]);

  // Save current state to history
  const saveToHistory = () => {
    const newState: HistoryState = {
      messages: [...messages],
      boundingBoxes: [...boundingBoxes],
      caption,
      imageUrl: imageUrl || undefined,
    };
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Handle undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setMessages(previousState.messages);
      setBoundingBoxes(previousState.boundingBoxes);
      setCaption(previousState.caption);
      if (previousState.imageUrl) setImageUrl(previousState.imageUrl);
      setHistoryIndex(historyIndex - 1);
    }
  };

  // Handle redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setMessages(nextState.messages);
      setBoundingBoxes(nextState.boundingBoxes);
      setCaption(nextState.caption);
      if (nextState.imageUrl) setImageUrl(nextState.imageUrl);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Handle new session
  const handleNewSession = () => {
    // Save current session
    if (currentSessionId) {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages, boundingBoxes, caption, imageUrl: imageUrl || undefined, imageFile: imageFile || undefined }
          : s
      ));
    }

    // Create new session
    const newSession: Session = {
      id: Date.now().toString(),
      name: `Session ${sessions.length + 1}`,
      timestamp: new Date(),
      messages: [],
      boundingBoxes: [],
    };
    
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionId(newSession.id);
    
    // Reset state
    setMessages([]);
    setBoundingBoxes([]);
    setMaskUrl(null);
    setCaption(undefined);
    setImageUrl(null);
    setImageFile(null);
    setCachedImageBase64(null);
    setHistory([]);
    setHistoryIndex(-1);
    setRegionSelection(null);
    setIsRegionSelectMode(false);
  };

  // Handle session selection
  const handleSessionSelect = (sessionId: string) => {
    // Save current session
    if (currentSessionId) {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages, boundingBoxes, caption, imageUrl: imageUrl || undefined, imageFile: imageFile || undefined, cachedImageBase64: cachedImageBase64 || undefined }
          : s
      ));
    }

    // Load selected session
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      setBoundingBoxes(session.boundingBoxes);
      setMaskUrl(null);
      setCaption(session.caption);
      setImageUrl(session.imageUrl || null);
      setImageFile(session.imageFile || null);
      setCachedImageBase64(session.cachedImageBase64 || null);
      setHistory([]);
      setHistoryIndex(-1);
      setRegionSelection(null);
      setIsRegionSelectMode(false);
    }
  };

  // Handle session rename
  const handleSessionRename = (sessionId: string, newName: string) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, name: newName }
        : s
    ));
  };

  // Handle image upload
  // Helper function to convert file to base64 for caching
  const fileToBase64ForCache = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Remove data:image/...;base64, prefix
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleImageUpload = async (fileOrUrl: File | string) => {
    saveToHistory();
    
    let uploadedFile: File | null = null;
    
    if (typeof fileOrUrl === 'string') {
      setImageUrl(fileOrUrl);
      setImageFile(null);
      setCachedImageBase64(null);
    } else {
      // Create object URL for display and cache base64 for API
      const url = URL.createObjectURL(fileOrUrl);
      setImageUrl(url);
      setImageFile(fileOrUrl);
      uploadedFile = fileOrUrl;
      
      // Cache base64 version asynchronously for API calls
      try {
        const base64 = await fileToBase64ForCache(fileOrUrl);
        setCachedImageBase64(base64);
      } catch (error) {
        console.error('Error caching image:', error);
        setCachedImageBase64(null);
      }
    }
    
    setBoundingBoxes([]);
    setMaskUrl(null);
    setCaption(undefined);
    
    
    // Automatically generate caption for the uploaded image
    if (uploadedFile) {
      setIsCaptionLoading(true);
      
      try {
        // Use cached base64 if available, otherwise convert
        const base64Image = cachedImageBase64 || await fileToBase64(uploadedFile);
        
        // Call API with automatic caption generation prompt
        const response = await apiClient.predict({
          text: 'Describe the image in detail.',
          image: base64Image,
          model: 'earthmind'
        });
        
        // Set the generated caption
        if (response.prediction) {
          setCaption(response.prediction);
          
          // Add caption success message
          const captionMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Caption generated successfully! Check the caption section below the image.',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, captionMessage]);
        }
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Failed to generate caption: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsCaptionLoading(false);
      }
    }
  };

  // Handle object rename
  const handleObjectRename = (objectId: string, newName: string) => {
    saveToHistory();
    setBoundingBoxes(prev => prev.map(box => 
      box.object_id === objectId 
        ? { ...box, object_id: newName }
        : box
    ));
  };

  // Handle clearing all overlays (bounding boxes and mask)
  const handleClearOverlays = () => {
    setBoundingBoxes([]);
    setMaskUrl(null);
  };

  // Helper function to convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/...;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Helper function to create image with marked region rectangle
  const createMarkedRegionImage = async (
    originalBase64: string,
    region: RegionSelection
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas with same dimensions as original image
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Draw rectangle outline on the region
        ctx.strokeStyle = '#f59e0b'; // amber color
        ctx.lineWidth = Math.max(3, Math.min(img.naturalWidth, img.naturalHeight) / 200);
        ctx.setLineDash([15, 8]);
        ctx.strokeRect(region.x, region.y, region.width, region.height);
        ctx.setLineDash([]);
        
        // Add a second solid inner stroke for visibility
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, Math.min(img.naturalWidth, img.naturalHeight) / 300);
        ctx.strokeRect(
          region.x + ctx.lineWidth, 
          region.y + ctx.lineWidth, 
          region.width - ctx.lineWidth * 2, 
          region.height - ctx.lineWidth * 2
        );
        
        // Add semi-transparent fill
        ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
        ctx.fillRect(region.x, region.y, region.width, region.height);
        
        // Convert canvas to base64
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = `data:image/png;base64,${originalBase64}`;
    });
  };

  // Handle sending message
  const handleSendMessage = async (
    message: string,
    queryType: 'chat' | 'localisation' | 'region'
  ) => {
    if (!imageUrl) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Please upload an image first before asking questions.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }
    
    // Validate region selection for region queries
    if (queryType === 'region' && !regionSelection) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Please draw a rectangle on the image to select a region first.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    saveToHistory();

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: queryType === 'region' && regionSelection 
        ? `[Region Query: ${Math.round(regionSelection.width)}x${Math.round(regionSelection.height)}px area] ${message}`
        : message,
      timestamp: new Date(),
      queryType,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Use cached base64 if available, otherwise convert image to base64
      let base64Image = '';
      if (cachedImageBase64) {
        base64Image = cachedImageBase64;
      } else if (imageFile) {
        base64Image = await fileToBase64(imageFile);
      } else if (!imageUrl) {
        throw new Error('No image available for this session');
      }
      
      // For region queries, create a marked version of the image
      let imageToSend = base64Image;
      if (queryType === 'region' && regionSelection) {
        imageToSend = await createMarkedRegionImage(base64Image, regionSelection);
      }

      // Use the new EarthMind API endpoints
      // For SAR images, always use earthmind model
      // For chat queries (non-SAR), don't send model - let server decide
      // For localisation queries (non-SAR), use remotesam model
      // For region queries, use earthmind model
      
      // Build the text prompt
      let textPrompt = message;
      if (queryType === 'region') {
        textPrompt = `Focus on the marked rectangular region in the image and answer: ${message}`;
      } else if (isSarMode && queryType === 'localisation') {
        // For SAR + localisation, add segmentation mask request to prompt
        textPrompt = `${message}. Provide segmentation mask.`;
      }
      
      const requestBody: any = {
        text: textPrompt,
        image: imageToSend,
      };
      
      // Determine model based on SAR mode and query type
      if (isSarMode) {
        // SAR mode always uses earthmind
        requestBody.model = 'earthmind';
      } else if (queryType === 'localisation') {
        requestBody.model = 'remotesam';
      } else if (queryType === 'region') {
        requestBody.model = 'earthmind';
      }
      
      // Include GSD if set
      if (gsd !== null) {
        requestBody.gsd = gsd;
      }
      
      const response = await apiClient.predict(requestBody);

      // Process response
      let responseText = response.prediction || 'Analysis completed.';
      
      // Handle bounding boxes from obbs (Oriented Bounding Boxes)
      if (response.obbs && response.obbs.length > 0) {
        // Get image dimensions for denormalization
        const img = new Image();
        img.src = imageUrl || '';
        await new Promise((resolve) => { img.onload = resolve; });
        const imgWidth = img.naturalWidth;
        const imgHeight = img.naturalHeight;
        
        const boxes: BoundingBox[] = response.obbs.map((flatCoords, idx) => {
          // Convert flat array [x1,y1,x2,y2,x3,y3,x4,y4] (normalized) to [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] (pixels)
          const coordinates: number[][] = [];
          for (let i = 0; i < flatCoords.length; i += 2) {
            // Denormalize coordinates: x *= width, y *= height
            const x = flatCoords[i] * imgWidth;
            const y = flatCoords[i + 1] * imgHeight;
            coordinates.push([x, y]);
          }
          return {
            object_id: `object_${idx + 1}`,
            coordinates,
          };
        });
        setBoundingBoxes(boxes);
        
        if (queryType === 'localisation') {
          responseText = `${responseText}\n\nDetected ${boxes.length} object(s). Bounding boxes displayed on the image.`;
        }
      }
      
      // Handle mask overlay for localization
      if (response.mask && queryType === 'localisation') {
        // Convert base64 mask to data URL
        const maskDataUrl = `data:image/png;base64,${response.mask}`;
        setMaskUrl(maskDataUrl);
      } else {
        setMaskUrl(null);
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to process request'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle dark mode
  const handleToggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('light-mode');
  };

  return (
    <div className={`relative w-screen h-screen overflow-hidden premium-gradient ${darkMode ? '' : 'light-mode'}`}>
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Mobile Chatbot Overlay */}
      {isChatbotOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 xl:hidden"
          onClick={() => setIsChatbotOpen(false)}
        />
      )}
      
      {/* Main content */}
      <div className="flex flex-col lg:flex-row h-screen">
        {/* Left Sidebar - Slide-in on mobile, shown on tablet+ */}
        <div className={`
          fixed md:relative top-0 left-0 h-screen z-50 md:z-0
          transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          md:block
        `}>
          <Sidebar 
            onImageUpload={handleImageUpload}
            onNewSession={handleNewSession}
            onSessionSelect={handleSessionSelect}
            onSessionRename={handleSessionRename}
            sessions={sessions}
            currentSessionId={currentSessionId}
            darkMode={darkMode}
            onToggleDarkMode={handleToggleDarkMode}
            gsd={gsd}
            onGsdChange={setGsd}
            isSarMode={isSarMode}
            onSarModeChange={setIsSarMode}
            onClose={() => setIsSidebarOpen(false)}
            hasActiveSession={!!imageUrl}
          />
        </div>
        
        {/* Center Image Panel - Full width on mobile, flex on larger screens */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ImagePanel
            imageUrl={imageUrl}
            boundingBoxes={boundingBoxes}
            caption={caption}
            isCaptionLoading={isCaptionLoading}
            selectedObjectId={selectedObjectId}
            onObjectSelect={setSelectedObjectId}
            maskUrl={maskUrl}
            isRegionSelectMode={isRegionSelectMode}
            regionSelection={regionSelection}
            onRegionSelect={setRegionSelection}
            onClearOverlays={handleClearOverlays}
            onImageUpload={handleImageUpload}
            gsd={gsd}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            onOpenChatbot={() => setIsChatbotOpen(true)}
          />
        </div>

        {/* Right Chatbot Panel - Slide-in on mobile/tablet, shown on desktop */}
        <div className={`
          fixed xl:relative top-0 right-0 h-screen z-50 xl:z-0
          transition-transform duration-300 ease-in-out
          ${isChatbotOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'}
          xl:block
        `}>
          <ChatbotPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
            boundingBoxes={boundingBoxes}
            selectedObjectId={selectedObjectId}
            onObjectSelect={setSelectedObjectId}
            onObjectRename={handleObjectRename}
            isRegionSelectMode={isRegionSelectMode}
            onRegionSelectModeChange={setIsRegionSelectMode}
            hasRegionSelected={regionSelection !== null}
            onClearOverlays={handleClearOverlays}
            onClose={() => setIsChatbotOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
