import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useWallet} from '../hooks/useWallet';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

export default function SettingsScreen({navigation}: Props) {
  const {publicKey} = useWallet();

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const copyAddress = () => {
    // TODO: Implement clipboard copy
    console.log('Copy address:', publicKey?.toString());
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
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>网络</Text>
            <Text style={styles.settingValue}>Devnet</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>安全</Text>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>修改密码短语</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>查看恢复助记词</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>关于</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Linking.openURL('https://trustport.app')}>
            <Text style={styles.settingLabel}>官方网站</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Linking.openURL('https://github.com/trustport')}>
            <Text style={styles.settingLabel}>GitHub</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>版本</Text>
            <Text style={styles.settingValue}>0.1.0</Text>
          </View>
        </View>

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
    fontSize: 24,
    color: '#666',
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
