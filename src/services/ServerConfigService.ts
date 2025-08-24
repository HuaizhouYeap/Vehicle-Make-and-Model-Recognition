import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServerConfig, ServerStatus, StoredServerConfig, ErrorType, AppError } from '../types';

const DEFAULT_CONFIG: ServerConfig = {
  alprUrl: '',
  vmmcrUrl: '',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  healthCheckInterval: 30000 // 30 seconds
};

const STORAGE_KEYS = {
  SERVER_CONFIG: '@vehicle_app_server_config',
  SERVER_STATUS: '@vehicle_app_server_status',
  CONFIG_HISTORY: '@vehicle_app_config_history'
};

class ServerConfigService {
  private config: ServerConfig = DEFAULT_CONFIG;
  private statusCache: { [url: string]: ServerStatus } = {};
  private healthCheckIntervals: { [url: string]: NodeJS.Timeout } = {};

  /**
   * Initialize the service and load stored configuration
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      await this.loadServerStatus();
      this.startHealthChecks();
    } catch (error) {
      console.warn('Failed to initialize ServerConfigService:', error);
      // Continue with default config if loading fails
    }
  }

  /**
   * Get current server configuration
   */
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Update server configuration
   */
  async updateConfig(newConfig: Partial<ServerConfig>): Promise<void> {
    const updatedConfig = { ...this.config, ...newConfig };
    
    // Validate URLs if provided
    if (newConfig.alprUrl && !this.isValidLocalTunnelUrl(newConfig.alprUrl)) {
      throw new AppError({
        type: ErrorType.CONFIGURATION_ERROR,
        message: 'Invalid ALPR LocalTunnel URL format',
        details: 'URL should match format: https://service-name.loca.lt',
        timestamp: new Date(),
        recoverable: true
      });
    }

    if (newConfig.vmmcrUrl && !this.isValidLocalTunnelUrl(newConfig.vmmcrUrl)) {
      throw new AppError({
        type: ErrorType.CONFIGURATION_ERROR,
        message: 'Invalid VMMCR LocalTunnel URL format',
        details: 'URL should match format: https://service-name.loca.lt',
        timestamp: new Date(),
        recoverable: true
      });
    }

    this.config = updatedConfig;
    await this.saveConfig();
    
    // Restart health checks with new URLs
    this.restartHealthChecks();
  }

  /**
   * Get server status for a specific service
   */
  getServerStatus(serviceType: 'alpr' | 'vmmcr'): ServerStatus {
    const url = serviceType === 'alpr' ? this.config.alprUrl : this.config.vmmcrUrl;
    return this.statusCache[url] || {
      isOnline: false,
      consecutiveFailures: 0,
      error: 'Status not checked yet'
    };
  }

  /**
   * Perform health check for a specific server
   */
  async checkServerHealth(url: string): Promise<ServerStatus> {
    if (!url) {
      return {
        isOnline: false,
        consecutiveFailures: 0,
        error: 'URL not configured'
      };
    }

    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
      
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const healthData = await response.json();
        const status: ServerStatus = {
          isOnline: true,
          responseTime,
          version: healthData.version,
          modelLoaded: healthData.model_loaded,
          lastChecked: new Date(),
          consecutiveFailures: 0
        };

        this.statusCache[url] = status;
        await this.saveServerStatus();
        return status;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const currentStatus = this.statusCache[url] || { consecutiveFailures: 0 };
      const status: ServerStatus = {
        isOnline: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        consecutiveFailures: currentStatus.consecutiveFailures + 1
      };

      this.statusCache[url] = status;
      await this.saveServerStatus();
      return status;
    }
  }

  /**
   * Check health for both ALPR and VMMCR servers
   */
  async checkAllServersHealth(): Promise<{ alpr: ServerStatus; vmmcr: ServerStatus }> {
    const [alprStatus, vmmcrStatus] = await Promise.all([
      this.checkServerHealth(this.config.alprUrl),
      this.checkServerHealth(this.config.vmmcrUrl)
    ]);

    return {
      alpr: alprStatus,
      vmmcr: vmmcrStatus
    };
  }

  /**
   * Auto-discover LocalTunnel URLs (placeholder for future implementation)
   */
  async autoDiscoverServers(): Promise<{ alpr?: string; vmmcr?: string }> {
    // This would implement actual auto-discovery logic
    // For now, return empty object as this requires external service integration
    console.log('Auto-discovery not yet implemented');
    return {};
  }

  /**
   * Get configuration history for quick setup
   */
  async getConfigHistory(): Promise<StoredServerConfig[]> {
    try {
      const historyJson = await AsyncStorage.getItem(STORAGE_KEYS.CONFIG_HISTORY);
      return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
      console.warn('Failed to load config history:', error);
      return [];
    }
  }

  /**
   * Save current configuration to history
   */
  async saveConfigToHistory(): Promise<void> {
    if (!this.config.alprUrl && !this.config.vmmcrUrl) {
      return; // Don't save empty configs
    }

    try {
      const history = await this.getConfigHistory();
      const newConfig: StoredServerConfig = {
        config: { ...this.config },
        lastUpdated: new Date(),
        isDefault: false
      };

      // Remove duplicates and add new config
      const filteredHistory = history.filter(
        item => item.config.alprUrl !== this.config.alprUrl || 
                item.config.vmmcrUrl !== this.config.vmmcrUrl
      );
      
      filteredHistory.unshift(newConfig);
      
      // Keep only last 10 configurations
      const limitedHistory = filteredHistory.slice(0, 10);
      
      await AsyncStorage.setItem(STORAGE_KEYS.CONFIG_HISTORY, JSON.stringify(limitedHistory));
    } catch (error) {
      console.warn('Failed to save config to history:', error);
    }
  }

  /**
   * Validate LocalTunnel URL format
   */
  private isValidLocalTunnelUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.protocol === 'https:' &&
        urlObj.hostname.endsWith('.loca.lt') &&
        urlObj.hostname.length > 8 // More than just '.loca.lt'
      );
    } catch {
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.restartHealthChecks();
  }

  /**
   * Restart health check intervals
   */
  private restartHealthChecks(): void {
    // Clear existing intervals
    Object.values(this.healthCheckIntervals).forEach(clearInterval);
    this.healthCheckIntervals = {};

    // Start new intervals for configured URLs
    if (this.config.alprUrl) {
      this.healthCheckIntervals[this.config.alprUrl] = setInterval(
        () => this.checkServerHealth(this.config.alprUrl),
        this.config.healthCheckInterval
      );
    }

    if (this.config.vmmcrUrl) {
      this.healthCheckIntervals[this.config.vmmcrUrl] = setInterval(
        () => this.checkServerHealth(this.config.vmmcrUrl),
        this.config.healthCheckInterval
      );
    }
  }

  /**
   * Load configuration from storage
   */
  private async loadConfig(): Promise<void> {
    try {
      const configJson = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_CONFIG);
      if (configJson) {
        const storedConfig = JSON.parse(configJson);
        this.config = { ...DEFAULT_CONFIG, ...storedConfig };
      }
    } catch (error) {
      console.warn('Failed to load server config:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SERVER_CONFIG, JSON.stringify(this.config));
      await this.saveConfigToHistory();
    } catch (error) {
      console.warn('Failed to save server config:', error);
    }
  }

  /**
   * Load server status from storage
   */
  private async loadServerStatus(): Promise<void> {
    try {
      const statusJson = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_STATUS);
      if (statusJson) {
        const storedStatus = JSON.parse(statusJson);
        // Convert date strings back to Date objects
        Object.keys(storedStatus).forEach(url => {
          if (storedStatus[url].lastChecked) {
            storedStatus[url].lastChecked = new Date(storedStatus[url].lastChecked);
          }
        });
        this.statusCache = storedStatus;
      }
    } catch (error) {
      console.warn('Failed to load server status:', error);
    }
  }

  /**
   * Save server status to storage
   */
  private async saveServerStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SERVER_STATUS, JSON.stringify(this.statusCache));
    } catch (error) {
      console.warn('Failed to save server status:', error);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    Object.values(this.healthCheckIntervals).forEach(clearInterval);
    this.healthCheckIntervals = {};
  }
}

// Export singleton instance
export default new ServerConfigService();