import { ALPRResponse, ImageData, AppError, ErrorType, ServerConfig } from '../types';
import ServerConfigService from './ServerConfigService';

class AndroidALPRService {
  private config: ServerConfig;
  private retryDelays = [1000, 2000, 4000]; // Exponential backoff delays

  constructor() {
    this.config = ServerConfigService.getConfig();
  }

  /**
   * Process image for license plate recognition
   */
  async processImage(imageData: ImageData): Promise<ALPRResponse> {
    this.config = ServerConfigService.getConfig();
    
    if (!this.config.alprUrl) {
      throw new AppError({
        type: ErrorType.CONFIGURATION_ERROR,
        message: 'ALPR server URL not configured',
        details: 'Please configure the ALPR LocalTunnel URL in settings',
        timestamp: new Date(),
        recoverable: true
      });
    }

    // Check server health before processing
    const serverStatus = await ServerConfigService.checkServerHealth(this.config.alprUrl);
    if (!serverStatus.isOnline) {
      throw new AppError({
        type: ErrorType.SERVER_ERROR,
        message: 'ALPR server is not available',
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
  private async processWithRetry(imageData: ImageData, attemptsLeft: number): Promise<ALPRResponse> {
    try {
      return await this.performRequest(imageData);
    } catch (error) {
      if (attemptsLeft > 0 && this.isRetryableError(error)) {
        const delay = this.retryDelays[this.config.retryAttempts - attemptsLeft] || 4000;
        console.log(`ALPR request failed, retrying in ${delay}ms. Attempts left: ${attemptsLeft - 1}`);
        
        await this.delay(delay);
        return this.processWithRetry(imageData, attemptsLeft - 1);
      }
      
      throw error;
    }
  }

  /**
   * Perform the actual HTTP request to ALPR server
   */
  private async performRequest(imageData: ImageData): Promise<ALPRResponse> {
    const startTime = Date.now();
    
    try {
      // Create FormData for image upload
      const formData = new FormData();
      formData.append('file', {
        uri: imageData.uri,
        type: imageData.type || 'image/jpeg',
        name: imageData.fileName || 'image.jpg'
      } as any);

      // Additional parameters for ALPR processing
      formData.append('confidence_threshold', '0.7');
      formData.append('max_plates', '10');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.alprUrl}/analyze`, {
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
          message: `ALPR server error: ${response.status}`,
          details: errorText || response.statusText,
          timestamp: new Date(),
          recoverable: response.status >= 500 // 5xx errors are typically retryable
        });
      }

      const result: ALPRResponse = await response.json();
      
      // Validate response structure
      if (!this.isValidALPRResponse(result)) {
        throw new AppError({
          type: ErrorType.INVALID_RESPONSE,
          message: 'Invalid response format from ALPR server',
          details: 'Response structure does not match expected format',
          timestamp: new Date(),
          recoverable: false
        });
      }

      // Add processing time if not provided
      if (!result.processing_time) {
        result.processing_time = (Date.now() - startTime) / 1000;
      }

      console.log(`ALPR processing completed: ${result.total_plates} plates detected in ${result.processing_time}s`);
      return result;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      // Handle network and timeout errors
      if (error.name === 'AbortError') {
        throw new AppError({
          type: ErrorType.TIMEOUT_ERROR,
          message: 'ALPR request timed out',
          details: `Request exceeded ${this.config.timeout}ms timeout`,
          timestamp: new Date(),
          recoverable: true,
          retryAction: () => this.processImage(imageData)
        });
      }

      if (error.name === 'TypeError' && error.message.includes('Network')) {
        throw new AppError({
          type: ErrorType.NETWORK_ERROR,
          message: 'Network error while connecting to ALPR server',
          details: error.message,
          timestamp: new Date(),
          recoverable: true,
          retryAction: () => this.processImage(imageData)
        });
      }

      // Generic error handling
      throw new AppError({
        type: ErrorType.SERVER_ERROR,
        message: 'Unexpected error during ALPR processing',
        details: error.message || 'Unknown error occurred',
        timestamp: new Date(),
        recoverable: true
      });
    }
  }

  /**
   * Validate ALPR response structure
   */
  private isValidALPRResponse(response: any): response is ALPRResponse {
    return (
      typeof response === 'object' &&
      typeof response.success === 'boolean' &&
      Array.isArray(response.results) &&
      typeof response.total_plates === 'number' &&
      typeof response.timestamp === 'string' &&
      response.results.every((plate: any) =>
        typeof plate.plate_id === 'number' &&
        Array.isArray(plate.bbox) &&
        plate.bbox.length === 4 &&
        typeof plate.detection_confidence === 'number' &&
        typeof plate.text === 'string' &&
        typeof plate.ocr_confidence === 'number'
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
  async processBatch(images: ImageData[]): Promise<ALPRResponse[]> {
    if (images.length === 0) {
      return [];
    }

    // Check server availability before batch processing
    const serverStatus = await ServerConfigService.checkServerHealth(this.config.alprUrl);
    if (!serverStatus.isOnline) {
      throw new AppError({
        type: ErrorType.SERVER_ERROR,
        message: 'ALPR server is not available for batch processing',
        details: serverStatus.error || 'Server health check failed',
        timestamp: new Date(),
        recoverable: true
      });
    }

    // Process images sequentially to avoid overwhelming the server
    const results: ALPRResponse[] = [];
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
   * Get service health status
   */
  async getHealthStatus() {
    return ServerConfigService.checkServerHealth(this.config.alprUrl);
  }

  /**
   * Test connection to ALPR server
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
   * Get server information
   */
  async getServerInfo() {
    try {
      const response = await fetch(`${this.config.alprUrl}/info`, {
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
      console.warn('Failed to get ALPR server info:', error);
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
export default new AndroidALPRService();