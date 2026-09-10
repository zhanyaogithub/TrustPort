const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      // Handle @solana-mobile/mobile-wallet-adapter-protocol/encoding subpath export
      if (moduleName === '@solana-mobile/mobile-wallet-adapter-protocol/encoding') {
        return context.resolveRequest(
          context,
          '@solana-mobile/mobile-wallet-adapter-protocol/lib/cjs/encoding.native.js',
          platform
        );
      }
      // Handle @solana-mobile/mobile-wallet-adapter-protocol-web3js subpath exports
      if (moduleName === '@solana-mobile/mobile-wallet-adapter-protocol-web3js') {
        return context.resolveRequest(
          context,
          '@solana-mobile/mobile-wallet-adapter-protocol-web3js/lib/cjs/index.native.js',
          platform
        );
      }
      // Default resolution
      return context.resolveRequest(context, moduleName, platform);
    },
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
