const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require("nativewind/metro");

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.includes('nativewind') && moduleName.includes('transformer')) {
        return {
          filePath: require.resolve('react-native-css-interop/dist/metro/transformer'),
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = withSentryConfig(
  withNativeWind(mergeConfig(getDefaultConfig(__dirname), config), { input: "./src/global.css" })
);
