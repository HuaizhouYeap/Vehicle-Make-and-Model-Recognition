import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Share
} from 'react-native';
import { CombinedAnalysisResult, ResultsDisplayProps, ALPRPlateResult, VMMCRVehicleResult } from '../types';

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  onExport,
  onRetry
}) => {
  const [selectedTab, setSelectedTab] = useState<'combined' | 'alpr' | 'vmmcr'>('combined');

  const formatConfidence = (confidence: number): string => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  const formatProcessingTime = (time: number): string => {
    return `${time.toFixed(2)}s`;
  };

  const handleExport = async () => {
    if (onExport) {
      onExport();
      return;
    }

    // Default export functionality
    try {
      const exportData = {
        timestamp: results.analysisTimestamp,
        totalProcessingTime: results.totalProcessingTime,
        alprResults: results.alprResults,
        vmmcrResults: results.vmmcrResults,
        correlatedData: results.correlatedData
      };

      const shareContent = `Vehicle Analysis Results\n\nTimestamp: ${results.analysisTimestamp}\nProcessing Time: ${formatProcessingTime(results.totalProcessingTime)}\n\nResults: ${JSON.stringify(exportData, null, 2)}`;

      await Share.share({
        message: shareContent,
        title: 'Vehicle Analysis Results'
      });
    } catch (error) {
      Alert.alert('Export Failed', 'Unable to export results. Please try again.');
    }
  };

  const renderPlateResult = (plate: ALPRPlateResult, index: number) => (
    <View key={index} style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>License Plate {plate.plate_id}</Text>
        <Text style={styles.confidenceText}>
          {formatConfidence(plate.detection_confidence)}
        </Text>
      </View>
      <View style={styles.resultContent}>
        <Text style={styles.plateText}>{plate.text}</Text>
        <Text style={styles.detailText}>
          OCR Confidence: {formatConfidence(plate.ocr_confidence)}
        </Text>
        <Text style={styles.detailText}>
          Location: [{plate.bbox.join(', ')}]
        </Text>
      </View>
    </View>
  );

  const renderVehicleResult = (vehicle: VMMCRVehicleResult, index: number) => (
    <View key={index} style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>Vehicle {vehicle.vehicle_id}</Text>
        <Text style={styles.confidenceText}>
          {formatConfidence(vehicle.detection_confidence)}
        </Text>
      </View>
      <View style={styles.resultContent}>
        <Text style={styles.vehicleColor}>
          Color: {vehicle.color} ({formatConfidence(vehicle.color_confidence)})
        </Text>
        <Text style={styles.sectionTitle}>Make/Model Predictions:</Text>
        {vehicle.make_model_predictions.map((prediction, idx) => (
          <Text key={idx} style={styles.predictionText}>
            {idx + 1}. {prediction}
          </Text>
        ))}
        <Text style={styles.detailText}>
          Location: [{vehicle.bbox.join(', ')}]
        </Text>
      </View>
    </View>
  );

  const renderCorrelatedData = () => {
    if (!results.correlatedData || results.correlatedData.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No correlated data available. This could mean:
          </Text>
          <Text style={styles.emptyStateDetail}>
            • Vehicles were detected without visible license plates
          </Text>
          <Text style={styles.emptyStateDetail}>
            • License plates were detected without associated vehicles
          </Text>
          <Text style={styles.emptyStateDetail}>
            • The correlation algorithm couldn't match objects
          </Text>
        </View>
      );
    }

    return results.correlatedData.map((data, index) => (
      <View key={index} style={styles.correlatedCard}>
        <View style={styles.correlatedHeader}>
          <Text style={styles.correlatedTitle}>
            Vehicle {data.vehicleId}
          </Text>
          <Text style={styles.correlatedConfidence}>
            Match: {formatConfidence(data.confidence)}
          </Text>
        </View>
        
        <View style={styles.correlatedContent}>
          {/* Vehicle Information */}
          <View style={styles.correlatedSection}>
            <Text style={styles.correlatedSectionTitle}>Vehicle Details</Text>
            <Text style={styles.correlatedDetail}>
              Color: {data.vehicleInfo.color} ({formatConfidence(data.vehicleInfo.color_confidence)})
            </Text>
            <Text style={styles.correlatedDetail}>
              Top Prediction: {data.vehicleInfo.make_model_predictions[0] || 'Unknown'}
            </Text>
            <Text style={styles.correlatedDetail}>
              Detection Confidence: {formatConfidence(data.vehicleInfo.detection_confidence)}
            </Text>
          </View>

          {/* Plate Information */}
          {data.plateInfo && (
            <View style={styles.correlatedSection}>
              <Text style={styles.correlatedSectionTitle}>License Plate</Text>
              <Text style={styles.correlatedPlateText}>{data.plateInfo.text}</Text>
              <Text style={styles.correlatedDetail}>
                OCR Confidence: {formatConfidence(data.plateInfo.ocr_confidence)}
              </Text>
            </View>
          )}
        </View>
      </View>
    ));
  };

  const renderSummaryStats = () => (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Analysis Summary</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {results.alprResults?.total_plates || 0}
          </Text>
          <Text style={styles.summaryLabel}>License Plates</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {results.vmmcrResults?.total_vehicles || 0}
          </Text>
          <Text style={styles.summaryLabel}>Vehicles</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {results.correlatedData?.length || 0}
          </Text>
          <Text style={styles.summaryLabel}>Correlated</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {formatProcessingTime(results.totalProcessingTime)}
          </Text>
          <Text style={styles.summaryLabel}>Total Time</Text>
        </View>
      </View>
    </View>
  );

  const hasAnyResults = () => {
    return (
      (results.alprResults && results.alprResults.results.length > 0) ||
      (results.vmmcrResults && results.vmmcrResults.vehicles.length > 0) ||
      (results.correlatedData && results.correlatedData.length > 0)
    );
  };

  if (!hasAnyResults()) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyResults}>
          <Text style={styles.emptyResultsIcon}>🔍</Text>
          <Text style={styles.emptyResultsTitle}>No Results Found</Text>
          <Text style={styles.emptyResultsText}>
            No vehicles or license plates were detected in the image.
          </Text>
          <Text style={styles.emptyResultsSubtext}>
            Try with a different image or check if the services are properly configured.
          </Text>
          {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderSummaryStats()}

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'combined' && styles.activeTab]}
          onPress={() => setSelectedTab('combined')}
        >
          <Text style={[styles.tabText, selectedTab === 'combined' && styles.activeTabText]}>
            Combined
          </Text>
        </TouchableOpacity>
        {results.alprResults && (
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'alpr' && styles.activeTab]}
            onPress={() => setSelectedTab('alpr')}
          >
            <Text style={[styles.tabText, selectedTab === 'alpr' && styles.activeTabText]}>
              ALPR ({results.alprResults.total_plates})
            </Text>
          </TouchableOpacity>
        )}
        {results.vmmcrResults && (
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'vmmcr' && styles.activeTab]}
            onPress={() => setSelectedTab('vmmcr')}
          >
            <Text style={[styles.tabText, selectedTab === 'vmmcr' && styles.activeTabText]}>
              VMMCR ({results.vmmcrResults.total_vehicles})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {selectedTab === 'combined' && renderCorrelatedData()}
        
        {selectedTab === 'alpr' && results.alprResults && (
          <View>
            {results.alprResults.results.map((plate, index) => 
              renderPlateResult(plate, index)
            )}
          </View>
        )}
        
        {selectedTab === 'vmmcr' && results.vmmcrResults && (
          <View>
            {results.vmmcrResults.vehicles.map((vehicle, index) => 
              renderVehicleResult(vehicle, index)
            )}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Text style={styles.exportButtonText}>📤 Export Results</Text>
        </TouchableOpacity>
        {onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>🔄 Analyze Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  activeTab: {
    backgroundColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  tabContent: {
    flex: 1,
    marginTop: 8,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4CAF50',
  },
  resultContent: {
    padding: 16,
  },
  plateText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  vehicleColor: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  predictionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    marginBottom: 2,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  correlatedCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  correlatedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  correlatedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  correlatedConfidence: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4CAF50',
  },
  correlatedContent: {
    padding: 16,
  },
  correlatedSection: {
    marginBottom: 16,
  },
  correlatedSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  correlatedDetail: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  correlatedPlateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#fff3e0',
    padding: 8,
    borderRadius: 4,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyStateDetail: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  emptyResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyResultsIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyResultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyResultsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    flex: 1,
    backgroundColor: '#FF9800',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ResultsDisplay;