import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  Clipboard,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useWallet} from '../hooks/useWallet';
import {TRUSTPORT_PROGRAM_ID} from '../contract/trustport';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

export default function SettingsScreen({navigation}: Props) {
  const {publicKey, disconnect} = useWallet();
  const [copied, setCopied] = useState(false);

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const copyAddress = () => {
    if (!publicKey) return;
    Clipboard.setString(publicKey.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyProgramId = () => {
    Clipboard.setString(TRUSTPORT_PROGRAM_ID.toString());
    Alert.alert('已复制', '程序 ID 已复制到剪贴板');
  };

  const handleDisconnect = () => {
    Alert.alert('断开连接', '确定要断开钱包连接吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '断开',
        style: 'destructive',
        onPress: async () => {
          await disconnect();
          navigation.navigate('Onboarding');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>钱包信息</Text>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>钱包地址</Text>
            <TouchableOpacity onPress={copyAddress}>
              <Text style={styles.settingValue}>
                {publicKey ? shortenAddress(publicKey.toString()) : '未连接'}
              </Text>
            </TouchableOpacity>
          </View>
          {copied && (
            <View style={styles.copiedBadge}>
              <Text style={styles.copiedText}>已复制到剪贴板</Text>
            </View>
          )}
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>网络</Text>
            <View style={styles.networkBadge}>
              <Text style={styles.networkText}>Devnet</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>合约信息</Text>
          <TouchableOpacity style={styles.settingItem} onPress={copyProgramId}>
            <View style={styles.programIdContainer}>
              <Text style={styles.settingLabel}>程序 ID</Text>
              <Text style={styles.programIdValue}>
                {shortenAddress(TRUSTPORT_PROGRAM_ID.toString())}
              </Text>
            </View>
            <Text style={styles.settingArrow}>⧉</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>关于</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Linking.openURL('https://github.com/zhanyaogithub/TrustPort')}>
            <Text style={styles.settingLabel}>GitHub 仓库</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>版本</Text>
            <Text style={styles.settingValue}>0.1.0</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
          <Text style={styles.disconnectText}>断开钱包连接</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            TrustPort - 双向可信关系转账钱包
          </Text>
          <Text style={styles.footerText}>
            Built for Solana Mobile Hackathon 2026
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a4e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
  },
  settingValue: {
    fontSize: 14,
    color: '#888',
  },
  settingArrow: {
    fontSize: 20,
    color: '#666',
  },
  copiedBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  copiedText: {
    fontSize: 12,
    color: '#4ade80',
  },
  networkBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  networkText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '600',
  },
  programIdContainer: {
    flex: 1,
  },
  programIdValue: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  disconnectButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  disconnectText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
});
