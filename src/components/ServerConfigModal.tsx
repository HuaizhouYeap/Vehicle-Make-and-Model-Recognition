import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { ServerConfig, ServerConfigModalProps, StoredServerConfig, ServerStatus } from '../types';
import ServerConfigService from '../services/ServerConfigService';

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  visible,
  onClose,
  onSave,
  currentConfig
}) => {
  const [config, setConfig] = useState<ServerConfig>(currentConfig);
  const [configHistory, setConfigHistory] = useState<StoredServerConfig[]>([]);
  const [testingConnection, setTestingConnection] = useState<{ alpr: boolean; vmmcr: boolean }>({
    alpr: false,
    vmmcr: false
  });
  const [serverStatus, setServerStatus] = useState<{ alpr?: ServerStatus; vmmcr?: ServerStatus }>({});

  useEffect(() => {
    if (visible) {
      setConfig(currentConfig);
      loadConfigHistory();
      checkCurrentServerStatus();
    }
  }, [visible, currentConfig]);

  const loadConfigHistory = async () => {
    try {
      const history = await ServerConfigService.getConfigHistory();
      setConfigHistory(history);
    } catch (error) {
      console.warn('Failed to load config history:', error);
    }
  };

  const checkCurrentServerStatus = async () => {
    if (currentConfig.alprUrl || currentConfig.vmmcrUrl) {
      const status = await ServerConfigService.checkAllServersHealth();
      setServerStatus(status);
    }
  };

  const handleSave = () => {
    // Validate URLs
    if (config.alprUrl && !isValidLocalTunnelUrl(config.alprUrl)) {
      Alert.alert(
        'Invalid URL',
        'ALPR URL must be a valid LocalTunnel URL (e.g., https://alpr-service.loca.lt)'
      );
      return;
    }

    if (config.vmmcrUrl && !isValidLocalTunnelUrl(config.vmmcrUrl)) {
      Alert.alert(
        'Invalid URL',
        'VMMCR URL must be a valid LocalTunnel URL (e.g., https://vmmcr-service.loca.lt)'
      );
      return;
    }

    if (!config.alprUrl && !config.vmmcrUrl) {
      Alert.alert(
        'Configuration Required',
        'Please provide at least one service URL to continue.'
      );
      return;
    }

    onSave(config);
    onClose();
  };

  const handleTestConnection = async (service: 'alpr' | 'vmmcr') => {
    const url = service === 'alpr' ? config.alprUrl : config.vmmcrUrl;
    
    if (!url) {
      Alert.alert('No URL', `Please enter a ${service.toUpperCase()} URL first.`);
      return;
    }

    setTestingConnection(prev => ({ ...prev, [service]: true }));

    try {
      const status = await ServerConfigService.checkServerHealth(url);
      setServerStatus(prev => ({ ...prev, [service]: status }));

      if (status.isOnline) {
        Alert.alert(
          'Connection Successful',
          `Successfully connected to ${service.toUpperCase()} server!\n\nResponse time: ${status.responseTime}ms\nVersion: ${status.version || 'Unknown'}\nModel loaded: ${status.modelLoaded ? 'Yes' : 'Unknown'}`
        );
      } else {
        Alert.alert(
          'Connection Failed',
          `Failed to connect to ${service.toUpperCase()} server.\n\nError: ${status.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      Alert.alert(
        'Connection Test Failed',
        `Error testing ${service.toUpperCase()} connection: ${error.message || 'Unknown error'}`
      );
    } finally {
      setTestingConnection(prev => ({ ...prev, [service]: false }));
    }
  };

  const handleUseHistoryConfig = (historicConfig: StoredServerConfig) => {
    setConfig(historicConfig.config);
  };

  const isValidLocalTunnelUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:' && urlObj.hostname.endsWith('.loca.lt');
    } catch {
      return false;
    }
  };

  const getStatusIndicator = (service: 'alpr' | 'vmmcr') => {
    const status = serverStatus[service];
    if (!status) return null;

    const color = status.isOnline ? '#4CAF50' : '#F44336';
    const text = status.isOnline ? 'Online' : 'Offline';

    return (
      <View style={[styles.statusIndicator, { backgroundColor: color }]}>
        <Text style={styles.statusText}>{text}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Server Configuration</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* ALPR Configuration */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ALPR Service</Text>
              {getStatusIndicator('alpr')}
            </View>
            <Text style={styles.label}>LocalTunnel URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://alpr-service-12345.loca.lt"
              value={config.alprUrl}
              onChangeText={(text) => setConfig(prev => ({ ...prev, alprUrl: text }))}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={[styles.testButton, testingConnection.alpr && styles.testButtonDisabled]}
              onPress={() => handleTestConnection('alpr')}
              disabled={testingConnection.alpr}
            >
              <Text style={styles.testButtonText}>
                {testingConnection.alpr ? 'Testing...' : 'Test Connection'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* VMMCR Configuration */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>VMMCR Service</Text>
              {getStatusIndicator('vmmcr')}
            </View>
            <Text style={styles.label}>LocalTunnel URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://vmmcr-service-12345.loca.lt"
              value={config.vmmcrUrl}
              onChangeText={(text) => setConfig(prev => ({ ...prev, vmmcrUrl: text }))}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={[styles.testButton, testingConnection.vmmcr && styles.testButtonDisabled]}
              onPress={() => handleTestConnection('vmmcr')}
              disabled={testingConnection.vmmcr}
            >
              <Text style={styles.testButtonText}>
                {testingConnection.vmmcr ? 'Testing...' : 'Test Connection'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Advanced Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Advanced Settings</Text>
            
            <Text style={styles.label}>Request Timeout (ms)</Text>
            <TextInput
              style={styles.input}
              value={String(config.timeout)}
              onChangeText={(text) => {
                const timeout = parseInt(text) || 30000;
                setConfig(prev => ({ ...prev, timeout }));
              }}
              keyboardType="numeric"
              placeholder="30000"
            />

            <Text style={styles.label}>Retry Attempts</Text>
            <TextInput
              style={styles.input}
              value={String(config.retryAttempts)}
              onChangeText={(text) => {
                const retryAttempts = parseInt(text) || 3;
                setConfig(prev => ({ ...prev, retryAttempts }));
              }}
              keyboardType="numeric"
              placeholder="3"
            />

            <Text style={styles.label}>Health Check Interval (ms)</Text>
            <TextInput
              style={styles.input}
              value={String(config.healthCheckInterval)}
              onChangeText={(text) => {
                const healthCheckInterval = parseInt(text) || 30000;
                setConfig(prev => ({ ...prev, healthCheckInterval }));
              }}
              keyboardType="numeric"
              placeholder="30000"
            />
          </View>

          {/* Configuration History */}
          {configHistory.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Configurations</Text>
              {configHistory.slice(0, 3).map((historicConfig, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.historyItem}
                  onPress={() => handleUseHistoryConfig(historicConfig)}
                >
                  <View style={styles.historyItemContent}>
                    <Text style={styles.historyItemTitle}>
                      Configuration {index + 1}
                    </Text>
                    <Text style={styles.historyItemUrl} numberOfLines={1}>
                      ALPR: {historicConfig.config.alprUrl || 'Not set'}
                    </Text>
                    <Text style={styles.historyItemUrl} numberOfLines={1}>
                      VMMCR: {historicConfig.config.vmmcrUrl || 'Not set'}
                    </Text>
                    <Text style={styles.historyItemDate}>
                      {new Date(historicConfig.lastUpdated).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Instructions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Setup Instructions</Text>
            <Text style={styles.instructionText}>
              1. Start your Google Colab notebooks for ALPR and VMMCR services
            </Text>
            <Text style={styles.instructionText}>
              2. Copy the LocalTunnel URLs from the Colab output (format: https://service-name.loca.lt)
            </Text>
            <Text style={styles.instructionText}>
              3. Paste the URLs in the fields above
            </Text>
            <Text style={styles.instructionText}>
              4. Test the connections to verify they work
            </Text>
            <Text style={styles.instructionText}>
              5. Save the configuration for use in the app
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Configuration</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: '#2196F3',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  testButtonDisabled: {
    backgroundColor: '#ccc',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  historyItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historyItemUrl: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  historyItemDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
});

export default ServerConfigModal;