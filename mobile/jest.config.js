module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-redux|@react-navigation|@reduxjs/toolkit|react-native-gesture-handler|immer|@react-native-async-storage|react-native-reanimated|react-native-worklets|react-native-worklets-core)/)',
  ],
};
