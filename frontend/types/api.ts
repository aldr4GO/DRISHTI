// TypeScript types matching the FastAPI backend models

export interface ImageMetadata {
  width: number;
  height: number;
  spatial_resolution_m: number;
}

export interface InputImage {
  image_id: string;
  image_url: string;
  metadata: ImageMetadata;
}

export interface CaptionQuery {
  instruction: string;
}

export interface GroundingQuery {
  instruction: string;
}

export interface BinaryAttributeQuery {
  instruction: string;
}

export interface NumericAttributeQuery {
  instruction: string;
}

export interface SemanticAttributeQuery {
  instruction: string;
}

export interface AttributeQuery {
  binary?: BinaryAttributeQuery;
  numeric?: NumericAttributeQuery;
  semantic?: SemanticAttributeQuery;
}

export interface Queries {
  caption_query?: CaptionQuery;
  grounding_query?: GroundingQuery;
  attribute_query?: AttributeQuery;
}

export interface SatelliteImageRequest {
  input_image: InputImage;
  queries: Queries;
}

// Response types
export interface BoundingBox {
  object_id: string;
  coordinates: number[][];
  confidence?: number;
}

export interface CaptionResponse {
  caption: string;
}

export interface GroundingResponse {
  objects: BoundingBox[];
}

export interface BinaryAttributeResponse {
  answer: string;
  confidence?: number;
}

export interface NumericAttributeResponse {
  answer: number;
  confidence?: number;
}

export interface SemanticAttributeResponse {
  answer: string;
}

export interface AttributeResponse {
  binary?: BinaryAttributeResponse;
  numeric?: NumericAttributeResponse;
  semantic?: SemanticAttributeResponse;
}

export interface QueryResponses {
  caption_response?: CaptionResponse;
  grounding_response?: GroundingResponse;
  attribute_response?: AttributeResponse;
}

export interface SatelliteImageResponse {
  image_id: string;
  responses: QueryResponses;
  processing_time_ms?: number;
}

// Chat message type for the chatbot
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  queryType?: 'chat' | 'localisation' | 'region';
}

// Rectangle region selection for region-based queries
export interface RegionSelection {
  x: number;      // Top-left x in image pixels
  y: number;      // Top-left y in image pixels
  width: number;  // Width in image pixels
  height: number; // Height in image pixels
}

// Session type for managing multiple sessions
export interface Session {
  id: string;
  name: string;
  timestamp: Date;
  imageUrl?: string;
  imageFile?: File;
  cachedImageBase64?: string; // Cached original image for API (base64)
  messages: ChatMessage[];
  boundingBoxes: BoundingBox[];
  caption?: string;
}

// History state for undo/redo
export interface HistoryState {
  messages: ChatMessage[];
  boundingBoxes: BoundingBox[];
  caption?: string;
  imageUrl?: string;
}

// ============================================
// EarthMind API Types (New SSH Server API)
// ============================================

// Request types for /predict, /earthmind, /remotesam endpoints
export interface PredictRequest {
  text: string;
  image?: string;  // base64 string
  images?: string[];  // array of base64 strings
  image_paths?: string[];  // array of file paths
  select?: number;  // 1-based index to select specific frame
  model?: 'earthmind' | 'remotesam';
  gsd?: number;  // Ground Sample Distance in meters per pixel
}

// Response type for /predict, /earthmind, /remotesam endpoints
export interface PredictResponse {
  prediction: string;
  mask: string;  // base64 encoded PNG mask (empty string if no mask)
  obbs: number[][];  // Oriented Bounding Boxes, each box is [x1,y1,x2,y2,x3,y3,x4,y4] (8 values)
}

// Request type for /evaluate endpoint
export interface EvaluateRequest {
  input_image: {
    image_url: string;  // URL or local server path
    image_id: string;
    metadata: {
      width: number;
      height: number;
    };
  };
  queries: {
    caption_query?: {
      instruction: string;
    };
    grounding_query?: {
      instruction: string;
    };
    attribute_query?: {
      binary?: {
        instruction: string;
      };
      numeric?: {
        instruction: string;
      };
      semantic?: {
        instruction: string;
      };
    };
  };
}

// Response type for /evaluate endpoint
export interface EvaluateResponse {
  input_image: {
    image_url: string;
    image_id: string;
    metadata: {
      width: number;
      height: number;
    };
  };
  queries: {
    caption_query?: {
      instruction: string;
      response: string;
    };
    grounding_query?: {
      instruction: string;
      response: {
        [key: string]: {
          'object-id': string;
          obbox: number[][];
        };
      };
    };
    attribute_query?: {
      binary?: {
        instruction: string;
        response: string;
      };
      numeric?: {
        instruction: string;
        response: string;
      };
      semantic?: {
        instruction: string;
        response: string;
      };
    };
  };
}
