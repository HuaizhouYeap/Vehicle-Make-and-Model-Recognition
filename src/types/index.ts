// Server Configuration Types
export interface ServerConfig {
  alprUrl: string;
  vmmcrUrl: string;
  timeout: number;
  retryAttempts: number;
  healthCheckInterval: number;
}

export interface ServerStatus {
  isOnline: boolean;
  responseTime?: number;
  version?: string;
  modelLoaded?: boolean;
  lastChecked?: Date;
  error?: string;
  consecutiveFailures: number;
}

// ALPR Service Types
export interface ALPRPlateResult {
  plate_id: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  detection_confidence: number;
  text: string;
  ocr_confidence: number;
}

export interface ALPRResponse {
  success: boolean;
  results: ALPRPlateResult[];
  total_plates: number;
  processing_time: number;
  timestamp: string;
  error?: string;
}

// VMMCR Service Types
export interface VMMCRVehicleResult {
  vehicle_id: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  detection_confidence: number;
  color: string;
  color_confidence: number;
  make_model_predictions: string[];
  dominant_colors: number[][];
}

export interface VMMCRResponse {
  success: boolean;
  vehicles: VMMCRVehicleResult[];
  total_vehicles: number;
  processing_time: number;
  timestamp: string;
  error?: string;
}

// Combined Analysis Types
export interface CombinedAnalysisResult {
  alprResults?: ALPRResponse;
  vmmcrResults?: VMMCRResponse;
  correlatedData?: CorrelatedVehicleData[];
  totalProcessingTime: number;
  analysisTimestamp: string;
}

export interface CorrelatedVehicleData {
  vehicleId: number;
  plateId?: number;
  vehicleInfo: VMMCRVehicleResult;
  plateInfo?: ALPRPlateResult;
  confidence: number;
}

// Processing State Types
export enum ProcessingStage {
  IDLE = 'idle',
  UPLOADING = 'uploading',
  PREPROCESSING = 'preprocessing',
  ALPR_PROCESSING = 'alpr_processing',
  VMMCR_PROCESSING = 'vmmcr_processing',
  POST_PROCESSING = 'post_processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface ProcessingProgress {
  stage: ProcessingStage;
  progress: number; // 0-100
  message: string;
  startTime?: Date;
  estimatedTimeRemaining?: number;
}

// App State Types
export enum AnalysisMode {
  ALPR_ONLY = 'alpr_only',
  VMMCR_ONLY = 'vmmcr_only',
  COMBINED = 'combined'
}

export enum NetworkState {
  ONLINE = 'online',
  OFFLINE = 'offline',
  POOR_CONNECTION = 'poor_connection'
}

export interface AppSettings {
  defaultAnalysisMode: AnalysisMode;
  autoSaveResults: boolean;
  showDetailedProgress: boolean;
  enableBatchProcessing: boolean;
  maxRetryAttempts: number;
  connectionTimeout: number;
}

// Error Types
export enum ErrorType {
  NETWORK_ERROR = 'network_error',
  SERVER_ERROR = 'server_error',
  TIMEOUT_ERROR = 'timeout_error',
  INVALID_RESPONSE = 'invalid_response',
  IMAGE_PROCESSING_ERROR = 'image_processing_error',
  CONFIGURATION_ERROR = 'configuration_error'
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
  timestamp: Date;
  recoverable: boolean;
  retryAction?: () => Promise<void>;
}

// UI Component Types
export interface ServerConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: Partial<ServerConfig>) => void;
  currentConfig: ServerConfig;
}

export interface ResultsDisplayProps {
  results: CombinedAnalysisResult;
  onExport?: () => void;
  onRetry?: () => void;
}

export interface ProgressIndicatorProps {
  progress: ProcessingProgress;
  onCancel?: () => void;
}

// Image Processing Types
export interface ImageData {
  uri: string;
  fileName: string;
  type: string;
  size: number;
  base64?: string;
}

export interface ProcessedImage {
  original: ImageData;
  preprocessed?: ImageData;
  thumbnails?: {
    small: string;
    medium: string;
  };
}

// History and Storage Types
export interface AnalysisHistoryItem {
  id: string;
  timestamp: Date;
  imageData: ProcessedImage;
  results: CombinedAnalysisResult;
  analysisMode: AnalysisMode;
  processingTime: number;
}

export interface StoredServerConfig {
  config: ServerConfig;
  lastUpdated: Date;
  isDefault: boolean;
}