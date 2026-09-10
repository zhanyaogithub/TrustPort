import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useWallet} from '../hooks/useWallet';
import WalletPicker, {WalletInfo} from '../components/WalletPicker';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

export default function OnboardingScreen({navigation}: Props) {
  const {connect, connecting, connected, sessionRestored} = useWallet();
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const hasNavigated = React.useRef(false);

  // Single navigation effect: only navigate when this screen is focused
  // and connected becomes true. The ref prevents double-navigation when
  // Activity is recreated (e.g., returning from ZXing camera on Samsung).
  React.useEffect(() => {
    if (connected && !hasNavigated.current) {
      if (navigation.isFocused()) {
        hasNavigated.current = true;
        console.log('[Onboarding] Navigating to Home');
        navigation.navigate('Home');
      }
    }
  }, [connected, sessionRestored, navigation]);

  const handleConnect = () => {
    // Open wallet picker to let user choose which wallet to connect
    setPickerVisible(true);
  };

  const handleWalletSelect = async (wallet: WalletInfo) => {
    console.log('[Onboarding] Selected wallet:', wallet.appName, wallet.packageName);
    setPickerVisible(false);
    try {
      await connect(wallet.packageName);
      // Navigate directly after successful connect - don't rely on useEffect/AppState
      console.log('[Onboarding] Connect resolved, navigating to Home directly');
      navigation.navigate('Home');
    } catch (error: any) {
      console.error('[Onboarding] Connection failed:', error.message);
    }
  };

  const handlePickerCancel = () => {
    setPickerVisible(false);
  };

  if (!sessionRestored) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>🔐</Text>
          <Text style={styles.title}>TrustPort</Text>
          <Text style={styles.subtitle}>双向可信关系转账钱包</Text>
        </View>

        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>只向可信联系人转账</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>离线密码短语验证</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>Solana 链上安全保障</Text>
          </View>
        </View>

        {/* MWA Button - Primary */}
        <TouchableOpacity
          style={[styles.primaryButton, connecting && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={connecting || pickerVisible}>
          <Text style={styles.primaryButtonText}>
            {connecting ? '连接中...' : '连接钱包'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          点击后将搜索已安装的钱包应用{'\n'}
          选择钱包后自动完成授权连接
        </Text>
      </View>

      {/* Wallet Picker Modal */}
      <WalletPicker
        visible={pickerVisible}
        onSelect={handleWalletSelect}
        onCancel={handlePickerCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  features: {
    marginBottom: 48,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 20,
    color: '#4ade80',
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#6366f1',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  hint: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginTop: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
  },
});
