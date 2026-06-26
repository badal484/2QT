const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const { withNativeWind } = require("nativewind/metro");

const config = {
  resolver: {
    // Firebase uses platform-specific files (nativeModule.android.js) which are
    // overridden by package.json exports map when this flag is true. Disabling
    // restores Metro's .android.js > .js resolution order.
    unstable_enablePackageExports: false,
  },
};

module.exports = withNativeWind(mergeConfig(getDefaultConfig(__dirname), config), { input: "./src/global.css" });
