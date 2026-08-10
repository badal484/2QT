module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-redux|@react-navigation|@reduxjs/toolkit|react-native-gesture-handler|immer|@react-native-async-storage|react-native-reanimated|react-native-worklets|react-native-worklets-core|react-native-linear-gradient|react-native-haptic-feedback|react-native-sound|@msg91comm|lucide-react-native|@shopify|nativewind)/)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
