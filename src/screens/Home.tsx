import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
  Image,
  ActivityIndicator,
  Platform,
  StatusBar
} from 'react-native';
import { launchImageLibrary, ImagePickerOptions, ImagePickerResponse } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AnalysisMode,
  ProcessingStage,
  ProcessingProgress,
  CombinedAnalysisResult,
  ImageData,
  ServerStatus,
  NetworkState,
  AppError,
  ErrorType
} from '../types';

import ServerConfigService from '../services/ServerConfigService';
import AndroidALPRService from '../services/AndroidALPRService';
import AndroidVMMCRService from '../services/AndroidVMMCRService';

import ServerConfigModal from '../components/ServerConfigModal';
import ProgressIndicator from '../components/ProgressIndicator';
import ResultsDisplay from '../components/ResultsDisplay';

const { width: screenWidth } = Dimensions.get('window');

const Home: React.FC = () => {
  // State Management
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(AnalysisMode.COMBINED);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress>({
    stage: ProcessingStage.IDLE,
    progress: 0,
    message: 'Ready to analyze'
  });
  const [analysisResults, setAnalysisResults] = useState<CombinedAnalysisResult | null>(null);
  const [serverStatus, setServerStatus] = useState<{ alpr?: ServerStatus; vmmcr?: ServerStatus }>({});
  const [networkState, setNetworkState] = useState<NetworkState>(NetworkState.ONLINE);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // References
  const processingCancelRef = useRef<AbortController | null>(null);

  // Initialize services and check connectivity
  useEffect(() => {
    initializeApp();
    
    // Check server status periodically
    const statusInterval = setInterval(checkServerStatus, 30000);
    
    return () => {
      clearInterval(statusInterval);
      if (processingCancelRef.current) {
        processingCancelRef.current.abort();
      }
    };
  }, []);

  const initializeApp = async () => {
    try {
      await ServerConfigService.initialize();
      await checkServerStatus();
      
      // Load last used analysis mode
      const savedMode = await AsyncStorage.getItem('@analysis_mode');
      if (savedMode) {
        setAnalysisMode(savedMode as AnalysisMode);
      }
    } catch (error) {
      console.warn('Failed to initialize app:', error);
    }
  };

  const checkServerStatus = async () => {
    try {
      const status = await ServerConfigService.checkAllServersHealth();
      setServerStatus(status);
      
      // Determine network state based on server status
      const bothOffline = !status.alpr.isOnline && !status.vmmcr.isOnline;
      const oneOffline = !status.alpr.isOnline || !status.vmmcr.isOnline;
      
      if (bothOffline) {
        setNetworkState(NetworkState.OFFLINE);
      } else if (oneOffline) {
        setNetworkState(NetworkState.POOR_CONNECTION);
      } else {
        setNetworkState(NetworkState.ONLINE);
      }
    } catch (error) {
      console.warn('Failed to check server status:', error);
      setNetworkState(NetworkState.OFFLINE);
    }
  };

  const handleImagePicker = () => {
    const options: ImagePickerOptions = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      includeBase64: false
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const imageData: ImageData = {
          uri: asset.uri!,
          fileName: asset.fileName || 'image.jpg',
          type: asset.type || 'image/jpeg',
          size: asset.fileSize || 0
        };

        setSelectedImage(imageData);
        setAnalysisResults(null); // Clear previous results
      }
    });
  };

  const handleAnalyzeImage = async () => {
    if (!selectedImage) {
      Alert.alert('No Image', 'Please select an image first.');
      return;
    }

    // Check if required servers are available
    const config = ServerConfigService.getConfig();
    const requiredServices = getRequiredServices(analysisMode);
    
    for (const service of requiredServices) {
      const status = serverStatus[service];
      if (!status?.isOnline) {
        Alert.alert(
          'Service Unavailable',
          `${service.toUpperCase()} service is not available. Please check your server configuration.`,
          [
            { text: 'Configure', onPress: () => setShowConfigModal(true) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }
    }

    setIsProcessing(true);
    setAnalysisResults(null);
    processingCancelRef.current = new AbortController();

    try {
      await processImage(selectedImage, analysisMode);
    } catch (error) {
      handleProcessingError(error);
    } finally {
      setIsProcessing(false);
      processingCancelRef.current = null;
    }
  };

  const processImage = async (imageData: ImageData, mode: AnalysisMode) => {
    const startTime = new Date();
    setProcessingProgress({
      stage: ProcessingStage.UPLOADING,
      progress: 10,
      message: 'Preparing image for analysis...',
      startTime
    });

    try {
      let alprResults = null;
      let vmmcrResults = null;

      // ALPR Processing
      if (mode === AnalysisMode.ALPR_ONLY || mode === AnalysisMode.COMBINED) {
        setProcessingProgress({
          stage: ProcessingStage.ALPR_PROCESSING,
          progress: 30,
          message: 'Analyzing license plates...',
          startTime
        });

        alprResults = await AndroidALPRService.processImage(imageData);
      }

      // VMMCR Processing
      if (mode === AnalysisMode.VMMCR_ONLY || mode === AnalysisMode.COMBINED) {
        setProcessingProgress({
          stage: ProcessingStage.VMMCR_PROCESSING,
          progress: 60,
          message: 'Analyzing vehicle make and model...',
          startTime
        });

        vmmcrResults = await AndroidVMMCRService.processImage(imageData);
      }

      // Post Processing
      setProcessingProgress({
        stage: ProcessingStage.POST_PROCESSING,
        progress: 90,
        message: 'Correlating results...',
        startTime
      });

      const combinedResults = await correlateResults(alprResults, vmmcrResults, startTime);

      setProcessingProgress({
        stage: ProcessingStage.COMPLETED,
        progress: 100,
        message: 'Analysis completed successfully!',
        startTime
      });

      setAnalysisResults(combinedResults);

    } catch (error) {
      setProcessingProgress({
        stage: ProcessingStage.ERROR,
        progress: 0,
        message: 'Analysis failed',
        startTime
      });
      throw error;
    }
  };

  const correlateResults = async (alprResults: any, vmmcrResults: any, startTime: Date) => {
    // Simple correlation logic - can be enhanced with more sophisticated algorithms
    const correlatedData = [];

    if (alprResults && vmmcrResults) {
      // Try to correlate vehicles with plates based on bounding box proximity
      for (const vehicle of vmmcrResults.vehicles) {
        let bestMatch = null;
        let bestDistance = Infinity;

        for (const plate of alprResults.results) {
          const distance = calculateBoundingBoxDistance(vehicle.bbox, plate.bbox);
          if (distance < bestDistance && distance < 200) { // Proximity threshold
            bestDistance = distance;
            bestMatch = plate;
          }
        }

        correlatedData.push({
          vehicleId: vehicle.vehicle_id,
          plateId: bestMatch?.plate_id,
          vehicleInfo: vehicle,
          plateInfo: bestMatch,
          confidence: bestMatch ? Math.max(0, 1 - (bestDistance / 200)) : 0.5
        });
      }
    }

    const totalProcessingTime = (Date.now() - startTime.getTime()) / 1000;

    return {
      alprResults,
      vmmcrResults,
      correlatedData,
      totalProcessingTime,
      analysisTimestamp: new Date().toISOString()
    };
  };

  const calculateBoundingBoxDistance = (bbox1: number[], bbox2: number[]): number => {
    const [x1, y1, x2, y2] = bbox1;
    const [x3, y3, x4, y4] = bbox2;
    
    const center1 = [(x1 + x2) / 2, (y1 + y2) / 2];
    const center2 = [(x3 + x4) / 2, (y3 + y4) / 2];
    
    return Math.sqrt(
      Math.pow(center1[0] - center2[0], 2) + 
      Math.pow(center1[1] - center2[1], 2)
    );
  };

  const getRequiredServices = (mode: AnalysisMode): ('alpr' | 'vmmcr')[] => {
    switch (mode) {
      case AnalysisMode.ALPR_ONLY:
        return ['alpr'];
      case AnalysisMode.VMMCR_ONLY:
        return ['vmmcr'];
      case AnalysisMode.COMBINED:
        return ['alpr', 'vmmcr'];
      default:
        return [];
    }
  };

  const handleProcessingError = (error: any) => {
    console.error('Processing error:', error);
    
    let title = 'Analysis Failed';
    let message = 'An unexpected error occurred during analysis.';
    
    if (error instanceof AppError) {
      title = error.type.replace('_', ' ').toUpperCase();
      message = error.message;
      
      if (error.retryAction) {
        Alert.alert(title, message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: error.retryAction }
        ]);
        return;
      }
    }

    Alert.alert(title, message);
  };

  const handleCancelProcessing = () => {
    if (processingCancelRef.current) {
      processingCancelRef.current.abort();
    }
    setIsProcessing(false);
    setProcessingProgress({
      stage: ProcessingStage.IDLE,
      progress: 0,
      message: 'Analysis cancelled'
    });
  };

  const handleModeChange = async (mode: AnalysisMode) => {
    setAnalysisMode(mode);
    await AsyncStorage.setItem('@analysis_mode', mode);
  };

  const handleRetryAnalysis = () => {
    if (selectedImage) {
      handleAnalyzeImage();
    }
  };

  const getNetworkStatusColor = (): string => {
    switch (networkState) {
      case NetworkState.ONLINE:
        return '#4CAF50';
      case NetworkState.POOR_CONNECTION:
        return '#FF9800';
      case NetworkState.OFFLINE:
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getNetworkStatusText = (): string => {
    switch (networkState) {
      case NetworkState.ONLINE:
        return 'Online';
      case NetworkState.POOR_CONNECTION:
        return 'Partial';
      case NetworkState.OFFLINE:
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  const renderServerStatusIndicator = () => (
    <View style={styles.serverStatusContainer}>
      <Text style={styles.serverStatusTitle}>Service Status</Text>
      <View style={styles.serverStatusRow}>
        <View style={styles.serverStatusItem}>
          <View style={[
            styles.statusDot,
            { backgroundColor: serverStatus.alpr?.isOnline ? '#4CAF50' : '#F44336' }
          ]} />
          <Text style={styles.serverStatusText}>
            ALPR {serverStatus.alpr?.responseTime ? `(${serverStatus.alpr.responseTime}ms)` : ''}
          </Text>
        </View>
        <View style={styles.serverStatusItem}>
          <View style={[
            styles.statusDot,
            { backgroundColor: serverStatus.vmmcr?.isOnline ? '#4CAF50' : '#F44336' }
          ]} />
          <Text style={styles.serverStatusText}>
            VMMCR {serverStatus.vmmcr?.responseTime ? `(${serverStatus.vmmcr.responseTime}ms)` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.configButton}
          onPress={() => setShowConfigModal(true)}
        >
          <Text style={styles.configButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderModeSelector = () => (
    <View style={styles.modeSelectorContainer}>
      <Text style={styles.modeSelectorTitle}>Analysis Mode</Text>
      <View style={styles.modeButtons}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            analysisMode === AnalysisMode.ALPR_ONLY && styles.activeModeButton
          ]}
          onPress={() => handleModeChange(AnalysisMode.ALPR_ONLY)}
        >
          <Text style={[
            styles.modeButtonText,
            analysisMode === AnalysisMode.ALPR_ONLY && styles.activeModeButtonText
          ]}>
            ALPR Only
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.modeButton,
            analysisMode === AnalysisMode.VMMCR_ONLY && styles.activeModeButton
          ]}
          onPress={() => handleModeChange(AnalysisMode.VMMCR_ONLY)}
        >
          <Text style={[
            styles.modeButtonText,
            analysisMode === AnalysisMode.VMMCR_ONLY && styles.activeModeButtonText
          ]}>
            Vehicle Only
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.modeButton,
            analysisMode === AnalysisMode.COMBINED && styles.activeModeButton
          ]}
          onPress={() => handleModeChange(AnalysisMode.COMBINED)}
        >
          <Text style={[
            styles.modeButtonText,
            analysisMode === AnalysisMode.COMBINED && styles.activeModeButtonText
          ]}>
            Combined
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderImageSection = () => (
    <View style={styles.imageSection}>
      {selectedImage ? (
        <View style={styles.selectedImageContainer}>
          <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
          <TouchableOpacity
            style={styles.changeImageButton}
            onPress={handleImagePicker}
          >
            <Text style={styles.changeImageButtonText}>Change Image</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.imagePlaceholder} onPress={handleImagePicker}>
          <Text style={styles.imagePlaceholderIcon}>📸</Text>
          <Text style={styles.imagePlaceholderText}>Select Image</Text>
          <Text style={styles.imagePlaceholderSubtext}>
            Tap to choose an image for vehicle analysis
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (analysisResults) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.resultsHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setAnalysisResults(null)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.resultsTitle}>Analysis Results</Text>
        </View>
        <ResultsDisplay
          results={analysisResults}
          onRetry={handleRetryAnalysis}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Vehicle Recognition</Text>
          <View style={styles.networkStatus}>
            <View style={[styles.networkDot, { backgroundColor: getNetworkStatusColor() }]} />
            <Text style={styles.networkText}>{getNetworkStatusText()}</Text>
          </View>
        </View>

        {renderServerStatusIndicator()}
        {renderModeSelector()}
        {renderImageSection()}

        {isProcessing && (
          <ProgressIndicator
            progress={processingProgress}
            onCancel={handleCancelProcessing}
          />
        )}

        {!isProcessing && selectedImage && (
          <TouchableOpacity
            style={[
              styles.analyzeButton,
              networkState === NetworkState.OFFLINE && styles.analyzeButtonDisabled
            ]}
            onPress={handleAnalyzeImage}
            disabled={networkState === NetworkState.OFFLINE}
          >
            <Text style={styles.analyzeButtonText}>
              🔍 Analyze Image
            </Text>
          </TouchableOpacity>
        )}

        {networkState === NetworkState.OFFLINE && (
          <View style={styles.offlineWarning}>
            <Text style={styles.offlineWarningText}>
              ⚠️ Services are offline. Please check your server configuration.
            </Text>
          </View>
        )}
      </ScrollView>

      <ServerConfigModal
        visible={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onSave={async (config) => {
          await ServerConfigService.updateConfig(config);
          await checkServerStatus();
        }}
        currentConfig={ServerConfigService.getConfig()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  networkText: {
    fontSize: 12,
    color: '#666',
  },
  serverStatusContainer: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serverStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  serverStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serverStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  serverStatusText: {
    fontSize: 12,
    color: '#666',
  },
  configButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  configButtonText: {
    fontSize: 16,
  },
  modeSelectorContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeSelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  modeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modeButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  activeModeButton: {
    backgroundColor: '#2196F3',
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  activeModeButtonText: {
    color: '#fff',
  },
  imageSection: {
    margin: 16,
    marginTop: 0,
  },
  selectedImageContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  changeImageButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  changeImageButtonText: {
    fontSize: 14,
    color: '#666',
  },
  imagePlaceholder: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 48,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  imagePlaceholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  imagePlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  imagePlaceholderSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  analyzeButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  analyzeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  offlineWarning: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  offlineWarningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default Home;