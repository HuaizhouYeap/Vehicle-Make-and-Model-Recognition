# Vehicle Recognition Mobile App

A React Native application for vehicle make/model recognition and automatic license plate recognition (ALPR) that integrates with Google Colab services via LocalTunnel.

## Features

### Core Functionality
- 📱 **Cross-platform mobile app** (Android/iOS support)
- 🚗 **Vehicle Make and Model Recognition (VMMCR)**
- 🔍 **Automatic License Plate Recognition (ALPR)**
- 🔄 **Combined analysis mode** with correlation
- 📊 **Detailed results display** with confidence scores
- 📤 **Export functionality** for analysis results

### Advanced Features
- 🌐 **LocalTunnel integration** for Google Colab services
- ⚙️ **Dynamic server configuration** with URL validation
- 💾 **Configuration persistence** and history
- 🔌 **Real-time health monitoring** with retry logic
- 📈 **Progress tracking** with cancellation support
- 🔄 **Automatic retry mechanisms** with exponential backoff
- 🎯 **Batch processing** capabilities
- 📱 **Offline/online state management**

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- React Native development environment
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation
1. Install dependencies:
```bash
npm install
```

2. For Android development:
```bash
npx react-native run-android
```

3. For iOS development (macOS only):
```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

## Google Colab Integration

### Setting Up ALPR Service
1. Open your ALPR Google Colab notebook
2. Run the cells to start the ALPR service
3. Copy the LocalTunnel URL (format: `https://alpr-service-12345.loca.lt`)
4. Paste it in the app's server configuration

### Setting Up VMMCR Service
1. Open your VMMCR Google Colab notebook
2. Run the cells to start the VMMCR service
3. Copy the LocalTunnel URL (format: `https://vmmcr-service-12345.loca.lt`)
4. Paste it in the app's server configuration

### Configuration Steps
1. Tap the settings gear (⚙️) icon in the app
2. Enter your LocalTunnel URLs for ALPR and VMMCR services
3. Test the connections to verify they work
4. Save the configuration

## Usage Guide

### Basic Analysis
1. **Select Image**: Tap "Select Image" to choose a photo from your device
2. **Choose Mode**: Select analysis mode:
   - **ALPR Only**: License plate recognition only
   - **Vehicle Only**: Vehicle make/model recognition only
   - **Combined**: Both services with correlation
3. **Analyze**: Tap "🔍 Analyze Image" to start processing
4. **View Results**: Review detailed analysis results with confidence scores

### Advanced Features
- **Server Status**: Monitor real-time service availability
- **Configuration History**: Quick access to previous server configurations
- **Export Results**: Share analysis results in JSON format
- **Retry Logic**: Automatic retry on temporary failures
- **Batch Processing**: Process multiple images (via service APIs)

## API Integration

### ALPR Service Response Format
```json
{
  "success": true,
  "results": [
    {
      "plate_id": 1,
      "bbox": [x1, y1, x2, y2],
      "detection_confidence": 0.95,
      "text": "ABC123",
      "ocr_confidence": 0.87
    }
  ],
  "total_plates": 1,
  "processing_time": 2.1,
  "timestamp": "2025-01-10T12:30:45"
}
```

### VMMCR Service Response Format
```json
{
  "success": true,
  "vehicles": [
    {
      "vehicle_id": 1,
      "bbox": [x1, y1, x2, y2],
      "detection_confidence": 0.92,
      "color": "Blue",
      "color_confidence": 0.85,
      "make_model_predictions": ["Toyota Camry", "Honda Accord"],
      "dominant_colors": [[45, 67, 89]]
    }
  ],
  "total_vehicles": 1,
  "processing_time": 3.2,
  "timestamp": "2025-01-10T12:30:48"
}
```

## Architecture

### Service Layer
- **ServerConfigService**: Manages server URLs, health checks, and configuration persistence
- **AndroidALPRService**: Handles ALPR API communication with retry logic
- **AndroidVMMCRService**: Handles VMMCR API communication with retry logic

### UI Components
- **Home Screen**: Main interface with image selection and analysis
- **ServerConfigModal**: Server configuration interface with validation
- **ProgressIndicator**: Real-time progress tracking with cancellation
- **ResultsDisplay**: Comprehensive results visualization with export

### Key Features Implementation
- **Health Monitoring**: Automatic periodic checks every 30 seconds
- **Retry Logic**: Exponential backoff (1s, 2s, 4s delays)
- **URL Validation**: LocalTunnel format validation (`https://*.loca.lt`)
- **Error Handling**: Specific error types with recovery suggestions
- **State Persistence**: Configuration and analysis mode persistence

## Troubleshooting

### Common Issues
1. **Service Offline**: Check if Colab notebooks are running and LocalTunnel URLs are correct
2. **Connection Timeout**: Increase timeout in advanced settings or check network
3. **Invalid URL**: Ensure LocalTunnel URLs follow format `https://service-name.loca.lt`
4. **Poor Results**: Try with higher quality images or different lighting conditions

### Error Messages
- **Configuration Error**: Check server URL format and settings
- **Network Error**: Verify internet connection and service availability  
- **Timeout Error**: Increase timeout setting or check service response time
- **Server Error**: Check Colab notebook status and restart if needed

### Performance Tips
- Use images under 1MB for faster processing
- Ensure good lighting and clear view of vehicles/plates
- Close other apps to free memory during analysis
- Check service status before processing large batches

## Development

### Project Structure
```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components
├── services/           # API and business logic
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

### Adding New Features
1. Define types in `src/types/index.ts`
2. Implement service logic in `src/services/`
3. Create UI components in `src/components/`
4. Update main screen in `src/screens/Home.tsx`

### Testing
Run the test suite:
```bash
npm test
```

For device testing:
```bash
# Android
npx react-native run-android --device

# iOS
npx react-native run-ios --device
```

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License
MIT License - see LICENSE file for details