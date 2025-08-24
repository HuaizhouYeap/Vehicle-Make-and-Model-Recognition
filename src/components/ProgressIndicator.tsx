import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { ProcessingProgress, ProcessingStage, ProgressIndicatorProps } from '../types';

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  onCancel
}) => {
  const animatedProgress = new Animated.Value(progress.progress);

  React.useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress.progress,
      duration: 300,
      useNativeDriver: false
    }).start();
  }, [progress.progress]);

  const getStageIcon = (stage: ProcessingStage): string => {
    switch (stage) {
      case ProcessingStage.UPLOADING:
        return '📤';
      case ProcessingStage.PREPROCESSING:
        return '🔄';
      case ProcessingStage.ALPR_PROCESSING:
        return '🔍';
      case ProcessingStage.VMMCR_PROCESSING:
        return '🚗';
      case ProcessingStage.POST_PROCESSING:
        return '⚙️';
      case ProcessingStage.COMPLETED:
        return '✅';
      case ProcessingStage.ERROR:
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStageColor = (stage: ProcessingStage): string => {
    switch (stage) {
      case ProcessingStage.COMPLETED:
        return '#4CAF50';
      case ProcessingStage.ERROR:
        return '#F44336';
      case ProcessingStage.IDLE:
        return '#9E9E9E';
      default:
        return '#2196F3';
    }
  };

  const formatTime = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getElapsedTime = (): string => {
    if (!progress.startTime) return '--:--';
    const elapsed = (Date.now() - progress.startTime.getTime()) / 1000;
    return formatTime(elapsed);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.stageInfo}>
          <Text style={styles.stageIcon}>{getStageIcon(progress.stage)}</Text>
          <Text style={styles.stageText}>{progress.message}</Text>
        </View>
        {onCancel && progress.stage !== ProcessingStage.COMPLETED && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: animatedProgress.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%']
                }),
                backgroundColor: getStageColor(progress.stage)
              }
            ]}
          />
        </View>
        <Text style={styles.progressText}>{Math.round(progress.progress)}%</Text>
      </View>

      <View style={styles.timeInfo}>
        <Text style={styles.timeText}>
          Elapsed: {getElapsedTime()}
        </Text>
        {progress.estimatedTimeRemaining && (
          <Text style={styles.timeText}>
            Remaining: {formatTime(progress.estimatedTimeRemaining)}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stageIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  stageText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#ff5722',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 40,
    textAlign: 'right',
  },
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
});

export default ProgressIndicator;