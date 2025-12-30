// API client for connecting to FastAPI backend

import { 
  SatelliteImageRequest, 
  SatelliteImageResponse,
  PredictRequest,
  PredictResponse,
  EvaluateRequest,
  EvaluateResponse
} from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  async analyzeSatelliteImage(
    request: SatelliteImageRequest
  ): Promise<SatelliteImageResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  async healthCheck(): Promise<{ status: string; timestamp: number; ml_models_loaded: boolean }> {
    const response = await fetch(`${this.baseUrl}/health`);
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return response.json();
  }

  async testCaption(instruction: string): Promise<{ caption: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/test/caption?instruction=${encodeURIComponent(instruction)}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Caption test failed: ${response.statusText}`);
    }

    return response.json();
  }

  async testGrounding(instruction: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/test/grounding?instruction=${encodeURIComponent(instruction)}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Grounding test failed: ${response.statusText}`);
    }

    return response.json();
  }

  async testBinary(instruction: string): Promise<{ answer: string; confidence: number }> {
    const response = await fetch(`${this.baseUrl}/api/v1/test/binary?instruction=${encodeURIComponent(instruction)}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Binary test failed: ${response.statusText}`);
    }

    return response.json();
  }

  async testNumeric(instruction: string): Promise<{ answer: number; confidence: number }> {
    const response = await fetch(`${this.baseUrl}/api/v1/test/numeric?instruction=${encodeURIComponent(instruction)}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Numeric test failed: ${response.statusText}`);
    }

    return response.json();
  }

  async testSemantic(instruction: string): Promise<{ answer: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/test/semantic?instruction=${encodeURIComponent(instruction)}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Semantic test failed: ${response.statusText}`);
    }

    return response.json();
  }

  // ============================================
  // EarthMind API Methods (New SSH Server API)
  // ============================================

  /**
   * General endpoint that routes to either EarthMind or RemoteSAM
   * If no model specified, selects one based on internal logic
   */
  async predict(request: PredictRequest): Promise<PredictResponse> {
    const response = await fetch(`${this.baseUrl}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Predict API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Forces request to be processed by EarthMind model
   */
  async earthmind(request: Omit<PredictRequest, 'model'>): Promise<PredictResponse> {
    const response = await fetch(`${this.baseUrl}/earthmind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`EarthMind API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Forces request to be processed by RemoteSAM model (specialized for segmentation)
   */
  async remotesam(request: Omit<PredictRequest, 'model'>): Promise<PredictResponse> {
    const response = await fetch(`${this.baseUrl}/remotesam`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`RemoteSAM API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Complex endpoint for running multiple evaluation tasks
   * (captioning, grounding, attributes) on a single image
   */
  async evaluate(request: EvaluateRequest): Promise<EvaluateResponse> {
    const response = await fetch(`${this.baseUrl}/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Evaluate API error: ${response.statusText}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();
