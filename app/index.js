// Polyfill crypto.getRandomValues for @solana/web3.js Keypair.generate()
import 'react-native-get-random-values';

// Polyfill TextEncoder/TextDecoder for Hermes/JSC
import {TextEncoder, TextDecoder} from 'text-encoding';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
