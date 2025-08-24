import { Alert, Platform } from 'react-native';
import { AppError, ErrorType, ImageData } from '../types';

/**
 * Utility functions for the Vehicle Recognition app
 */

/**
 * Format file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format timestamp to readable date string
 */
export const formatTimestamp = (timestamp: string | Date): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString();
};

/**
 * Generate a unique ID for analysis results
 */
export const generateAnalysisId = (): string => {
  return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate image data before processing
 */
export const validateImageData = (imageData: ImageData): AppError | null => {
  if (!imageData.uri) {
    return new AppError({
      type: ErrorType.IMAGE_PROCESSING_ERROR,
      message: 'Invalid image URI',
      details: 'Image URI is required for processing',
      timestamp: new Date(),
      recoverable: false
    });
  }

  // Check file size (limit to 10MB)
  if (imageData.size && imageData.size > 10 * 1024 * 1024) {
    return new AppError({
      type: ErrorType.IMAGE_PROCESSING_ERROR,
      message: 'Image file too large',
      details: `Image size (${formatFileSize(imageData.size)}) exceeds 10MB limit`,
      timestamp: new Date(),
      recoverable: false
    });
  }

  // Check file type
  if (imageData.type && !imageData.type.startsWith('image/')) {
    return new AppError({
      type: ErrorType.IMAGE_PROCESSING_ERROR,
      message: 'Invalid file type',
      details: `File type ${imageData.type} is not supported. Please use JPG, PNG, or other image formats.`,
      timestamp: new Date(),
      recoverable: false
    });
  }

  return null;
};

/**
 * Show error alert with appropriate styling
 */
export const showErrorAlert = (error: AppError | Error, onRetry?: () => void) => {
  let title = 'Error';
  let message = 'An unexpected error occurred.';
  let buttons: any[] = [{ text: 'OK', style: 'cancel' }];

  if (error instanceof AppError) {
    title = error.type.replace('_', ' ').toUpperCase();
    message = error.message;
    
    if (error.details) {
      message += `\n\n${error.details}`;
    }

    if (error.retryAction || onRetry) {
      buttons.unshift({
        text: 'Retry',
        onPress: error.retryAction || onRetry
      });
    }
  } else {
    message = error.message || 'Unknown error occurred.';
  }

  Alert.alert(title, message, buttons);
};

/**
 * Debounce function calls
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  waitFor: number
) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    clearTimeout(timeout);
    return new Promise((resolve) => {
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
  };
};

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
  return Platform.OS === 'android';
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
  return Platform.OS === 'ios';
};

/**
 * Get platform-specific styles
 */
export const getPlatformStyle = <T>(androidStyle: T, iosStyle: T): T => {
  return isAndroid() ? androidStyle : iosStyle;
};

/**
 * Format confidence percentage
 */
export const formatConfidence = (confidence: number): string => {
  return `${(confidence * 100).toFixed(1)}%`;
};

/**
 * Format processing time
 */
export const formatProcessingTime = (seconds: number): string => {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  } else if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }
};

/**
 * Calculate distance between two points
 */
export const calculateDistance = (
  point1: [number, number],
  point2: [number, number]
): number => {
  const [x1, y1] = point1;
  const [x2, y2] = point2;
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

/**
 * Calculate center point of a bounding box
 */
export const getBoundingBoxCenter = (bbox: [number, number, number, number]): [number, number] => {
  const [x1, y1, x2, y2] = bbox;
  return [(x1 + x2) / 2, (y1 + y2) / 2];
};

/**
 * Calculate area of a bounding box
 */
export const getBoundingBoxArea = (bbox: [number, number, number, number]): number => {
  const [x1, y1, x2, y2] = bbox;
  return Math.abs((x2 - x1) * (y2 - y1));
};

/**
 * Check if two bounding boxes intersect
 */
export const doBoundingBoxesIntersect = (
  bbox1: [number, number, number, number],
  bbox2: [number, number, number, number]
): boolean => {
  const [x1, y1, x2, y2] = bbox1;
  const [x3, y3, x4, y4] = bbox2;

  return !(x2 < x3 || x4 < x1 || y2 < y3 || y4 < y1);
};

/**
 * Sanitize filename for safe storage
 */
export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-z0-9\-_\.]/gi, '_').toLowerCase();
};

/**
 * Generate a short unique identifier
 */
export const generateShortId = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Color utilities
 */
export const hexToRgb = (hex: string): [number, number, number] | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : null;
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

/**
 * Get dominant color name from RGB values
 */
export const getColorName = (rgb: [number, number, number]): string => {
  const [r, g, b] = rgb;
  
  // Simple color classification
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  if (max < 50) return 'Black';
  if (min > 200) return 'White';
  if (diff < 30) return 'Gray';

  if (r > g && r > b) return 'Red';
  if (g > r && g > b) return 'Green';
  if (b > r && b > g) return 'Blue';
  if (r > b && g > b) return 'Yellow';
  if (r > g && b > g) return 'Magenta';
  if (g > r && b > r) return 'Cyan';

  return 'Unknown';
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};