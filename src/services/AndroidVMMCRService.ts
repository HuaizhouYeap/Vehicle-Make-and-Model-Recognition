import { VMMCRResponse, ImageData, AppError, ErrorType, ServerConfig } from '../types';
import ServerConfigService from './ServerConfigService';

class AndroidVMMCRService {
  private config: ServerConfig;
  private retryDelays = [1000, 2000, 4000]; // Exponential backoff delays

  constructor() {
    this.config = ServerConfigService.getConfig();
  }

  /**
   * Process image for vehicle make, model, and color recognition
   */
  async processImage(imageData: ImageData): Promise<VMMCRResponse> {
    this.config = ServerConfigService.getConfig();
    
    if (!this.config.vmmcrUrl) {
      throw new AppError({
        type: ErrorType.CONFIGURATION_ERROR,
        message: 'VMMCR server URL not configured',
        details: 'Please configure the VMMCR LocalTunnel URL in settings',
        timestamp: new Date(),
        recoverable: true
      });
    }

    // Check server health before processing
    const serverStatus = await ServerConfigService.checkServerHealth(this.config.vmmcrUrl);
    if (!serverStatus.isOnline) {
      throw new AppError({
        type: ErrorType.SERVER_ERROR,
        message: 'VMMCR server is not available',
        details: serverStatus.error || 'Server health check failed',
        timestamp: new Date(),
        recoverable: true,
        retryAction: () => this.processImage(imageData)
      });
    }

    return this.processWithRetry(imageData, this.config.retryAttempts);
  }

  /**
   * Process image with retry logic
   */
  private async processWithRetry(imageData: ImageData, attemptsLeft: number): Promise<VMMCRResponse> {
    try {
      return await this.performRequest(imageData);
    } catch (error) {
      if (attemptsLeft > 0 && this.isRetryableError(error)) {
        const delay = this.retryDelays[this.config.retryAttempts - attemptsLeft] || 4000;
        console.log(`VMMCR request failed, retrying in ${delay}ms. Attempts left: ${attemptsLeft - 1}`);
        
        await this.delay(delay);
        return this.processWithRetry(imageData, attemptsLeft - 1);
      }
      
      throw error;
    }
  }

  /**
   * Perform the actual HTTP request to VMMCR server
   */
  private async performRequest(imageData: ImageData): Promise<VMMCRResponse> {
    const startTime = Date.now();
    
    try {
      // Create FormData for image upload
      const formData = new FormData();
      formData.append('file', {
        uri: imageData.uri,
        type: imageData.type || 'image/jpeg',
        name: imageData.fileName || 'image.jpg'
      } as any);

      // Additional parameters for VMMCR processing
      formData.append('confidence_threshold', '0.7');
      formData.append('max_vehicles', '10');
      formData.append('include_color_analysis', 'true');
      formData.append('top_k_predictions', '3');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.vmmcrUrl}/analyze`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new AppError({
          type: ErrorType.SERVER_ERROR,
          message: `VMMCR server error: ${response.status}`,
          details: errorText || response.statusText,
          timestamp: new Date(),
          recoverable: response.status >= 500 // 5xx errors are typically retryable
        });
      }

      const result: VMMCRResponse = await response.json();
      
      // Validate response structure
      if (!this.isValidVMMCRResponse(result)) {
        throw new AppError({
          type: ErrorType.INVALID_RESPONSE,
          message: 'Invalid response format from VMMCR server',
          details: 'Response structure does not match expected format',
          timestamp: new Date(),
          recoverable: false
        });
      }

      // Add processing time if not provided
      if (!result.processing_time) {
        result.processing_time = (Date.now() - startTime) / 1000;
      }

      console.log(`VMMCR processing completed: ${result.total_vehicles} vehicles detected in ${result.processing_time}s`);
      return result;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      // Handle network and timeout errors
      if (error.name === 'AbortError') {
        throw new AppError({
          type: ErrorType.TIMEOUT_ERROR,
          message: 'VMMCR request timed out',
          details: `Request exceeded ${this.config.timeout}ms timeout`,
          timestamp: new Date(),
          recoverable: true,
          retryAction: () => this.processImage(imageData)
        });
      }

      if (error.name === 'TypeError' && error.message.includes('Network')) {
        throw new AppError({
          type: ErrorType.NETWORK_ERROR,
          message: 'Network error while connecting to VMMCR server',
          details: error.message,
          timestamp: new Date(),
          recoverable: true,
          retryAction: () => this.processImage(imageData)
        });
      }

      // Generic error handling
      throw new AppError({
        type: ErrorType.SERVER_ERROR,
        message: 'Unexpected error during VMMCR processing',
        details: error.message || 'Unknown error occurred',
        timestamp: new Date(),
        recoverable: true
      });
    }
  }

  /**
   * Validate VMMCR response structure
   */
  private isValidVMMCRResponse(response: any): response is VMMCRResponse {
    return (
      typeof response === 'object' &&
      typeof response.success === 'boolean' &&
      Array.isArray(response.vehicles) &&
      typeof response.total_vehicles === 'number' &&
      typeof response.timestamp === 'string' &&
      response.vehicles.every((vehicle: any) =>
        typeof vehicle.vehicle_id === 'number' &&
        Array.isArray(vehicle.bbox) &&
        vehicle.bbox.length === 4 &&
        typeof vehicle.detection_confidence === 'number' &&
        typeof vehicle.color === 'string' &&
        typeof vehicle.color_confidence === 'number' &&
        Array.isArray(vehicle.make_model_predictions) &&
        Array.isArray(vehicle.dominant_colors)
      )
    );
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof AppError) {
      return error.recoverable;
    }

    // Network errors and timeouts are generally retryable
    return (
      error.name === 'AbortError' ||
      error.name === 'TypeError' ||
      (error.response && error.response.status >= 500)
    );
  }

  /**
   * Batch process multiple images
   */
  async processBatch(images: ImageData[]): Promise<VMMCRResponse[]> {
    if (images.length === 0) {
      return [];
    }

    // Check server availability before batch processing
    const serverStatus = await ServerConfigService.checkServerHealth(this.config.vmmcrUrl);
    if (!serverStatus.isOnline) {
      throw new AppError({
        type: ErrorType.SERVER_ERROR,
        message: 'VMMCR server is not available for batch processing',
        details: serverStatus.error || 'Server health check failed',
        timestamp: new Date(),
        recoverable: true
      });
    }

    // Process images sequentially to avoid overwhelming the server
    const results: VMMCRResponse[] = [];
    const errors: AppError[] = [];

    for (let i = 0; i < images.length; i++) {
      try {
        console.log(`Processing image ${i + 1}/${images.length}`);
        const result = await this.processImage(images[i]);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process image ${i + 1}:`, error);
        errors.push(error as AppError);
        
        // Continue with other images unless it's a configuration error
        if (error instanceof AppError && error.type === ErrorType.CONFIGURATION_ERROR) {
          throw error;
        }
      }
    }

    if (results.length === 0 && errors.length > 0) {
      // If all images failed, throw the first error
      throw errors[0];
    }

    return results;
  }

  /**
   * Get detailed vehicle analysis with additional features
   */
  async getDetailedAnalysis(imageData: ImageData): Promise<VMMCRResponse & { additionalFeatures?: any }> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageData.uri,
        type: imageData.type || 'image/jpeg',
        name: imageData.fileName || 'image.jpg'
      } as any);

      // Request additional analysis features
      formData.append('detailed_analysis', 'true');
      formData.append('include_features', 'body_type,year_estimate,condition');

      const response = await fetch(`${this.config.vmmcrUrl}/detailed-analyze`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(this.config.timeout * 2) // Allow more time for detailed analysis
      });

      if (response.ok) {
        return await response.json();
      } else {
        // Fallback to regular analysis if detailed analysis is not available
        console.log('Detailed analysis not available, falling back to regular analysis');
        return await this.processImage(imageData);
      }
    } catch (error) {
      // Fallback to regular analysis on error
      console.warn('Detailed analysis failed, falling back to regular analysis:', error);
      return await this.processImage(imageData);
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    return ServerConfigService.checkServerHealth(this.config.vmmcrUrl);
  }

  /**
   * Test connection to VMMCR server
   */
  async testConnection(): Promise<boolean> {
    try {
      const status = await this.getHealthStatus();
      return status.isOnline;
    } catch {
      return false;
    }
  }

  /**
   * Get server information and supported features
   */
  async getServerInfo() {
    try {
      const response = await fetch(`${this.config.vmmcrUrl}/info`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to get VMMCR server info:', error);
    }
    
    return null;
  }

  /**
   * Get supported vehicle makes and models
   */
  async getSupportedModels(): Promise<string[] | null> {
    try {
      const response = await fetch(`${this.config.vmmcrUrl}/supported-models`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (response.ok) {
        const data = await response.json();
        return data.models || [];
      }
    } catch (error) {
      console.warn('Failed to get supported models:', error);
    }
    
    return null;
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export default new AndroidVMMCRService();