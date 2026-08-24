const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require("nativewind/metro");

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  projectRoot: __dirname,
  watchFolders: [__dirname],
  resolver: {
    blockList: [
      /.*\/android\/build\/.*/,
      /.*\/android\/app\/build\/.*/,
      /.*\/ios\/build\/.*/,
      /.*\/ios\/Pods\/.*/,
      /.*\/\.git\/.*/,
      /.*\/\.gradle\/.*/,
      /.*\/\.cxx\/.*/,
    ],
  },
};

module.exports = withSentryConfig(
  withNativeWind(mergeConfig(defaultConfig, config), {
    input: "./src/global.css",
    forceWriteFileSystem: true,
  })
);
