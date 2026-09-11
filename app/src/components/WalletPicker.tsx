import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  NativeModules,
} from 'react-native';

interface WalletInfo {
  packageName: string;
  appName: string;
  activityName: string;
  icon: string; // base64 data URI
}

interface WalletPickerProps {
  visible: boolean;
  onSelect: (wallet: WalletInfo) => void;
  onCancel: () => void;
}

export default function WalletPicker({visible, onSelect, onCancel}: WalletPickerProps) {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      discoverWallets();
    }
  }, [visible]);

  const discoverWallets = async () => {
    setLoading(true);
    setError('');
    try {
      const WalletDiscovery = NativeModules.WalletDiscovery;
      if (!WalletDiscovery) {
        // Fallback: if native module not available, just proceed without picker
        setError('无法加载钱包发现模块');
        setLoading(false);
        return;
      }
      const result = await WalletDiscovery.discoverWallets();
      setWallets(result || []);
      if (!result || result.length === 0) {
        setError('未发现已安装的钱包应用');
      }
    } catch (err: any) {
      console.error('[WalletPicker] Discovery failed:', err.message);
      setError('钱包发现失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({item}: {item: WalletInfo}) => (
    <TouchableOpacity
      style={styles.walletItem}
      onPress={() => onSelect(item)}>
      {item.icon ? (
        <Image source={{uri: item.icon}} style={styles.walletIcon} />
      ) : (
        <View style={[styles.walletIcon, styles.walletIconPlaceholder]}>
          <Text style={styles.walletIconText}>💰</Text>
        </View>
      )}
      <View style={styles.walletInfo}>
        <Text style={styles.walletName}>{item.appName}</Text>
        <Text style={styles.walletPackage}>{item.packageName}</Text>
      </View>
      <Text style={styles.selectArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>选择钱包</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            选择一个钱包应用进行连接授权
          </Text>

          {loading && (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>正在搜索已安装的钱包...</Text>
            </View>
          )}

          {!loading && error && (
            <View style={styles.centerContent}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={discoverWallets}>
                <Text style={styles.retryButtonText}>重试</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && wallets.length > 0 && (
            <FlatList
              data={wallets}
              renderItem={renderItem}
              keyExtractor={item => item.packageName}
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              未找到钱包？请确认已安装支持 MWA 协议的钱包应用
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export type {WalletInfo};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1e1e3a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  list: {
    marginBottom: 8,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#2a2a4a',
    borderRadius: 12,
    marginBottom: 8,
  },
  walletIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 14,
  },
  walletIconPlaceholder: {
    backgroundColor: '#3a3a5a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletIconText: {
    fontSize: 24,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  walletPackage: {
    fontSize: 12,
    color: '#666',
  },
  selectArrow: {
    fontSize: 24,
    color: '#6366f1',
    marginLeft: 8,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
  },
});
