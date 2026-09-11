import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  NativeModules,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useContacts} from '../hooks/useContacts';
import {PublicKey} from '@solana/web3.js';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmRelation'>;

type Step = 'scan' | 'verify' | 'success';

interface QRData {
  v: number;
  address: string;
  hash: string;
}

export default function ConfirmRelationScreen({navigation}: Props) {
  const {verifyAndAddContact, computeHash} = useContacts();
  const [step, setStep] = useState<Step>('scan');
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const parseQRContent = (content: string): QRData | null => {
    try {
      const data = JSON.parse(content);
      if (data.v && data.address && data.hash) {
        // Validate address
        new PublicKey(data.address);
        return data as QRData;
      }
    } catch {}
    return null;
  };

  const handleScanQR = async () => {
    try {
      const QRScanner = NativeModules.QRScanner;
      if (!QRScanner) {
        Alert.alert('错误', 'QR 扫描模块不可用');
        return;
      }
      const result = await QRScanner.scan();
      if (!result) return;

      const data = parseQRContent(result);
      if (data) {
        setQrData(data);
        setStep('verify');
      } else {
        Alert.alert('无法识别', '该二维码不是 TrustPort 可信关系二维码');
      }
    } catch (error: any) {
      if (error.code !== 'SCAN_CANCELLED') {
        console.error('[ScanQR] Error:', error.message);
        Alert.alert('扫描失败', error.message || '请重试');
      }
    }
  };

  const handleConfirm = async () => {
    if (!qrData) return;
    if (passphrase.length < 6) {
      Alert.alert('错误', '口令至少需要 6 个字符');
      return;
    }

    setLoading(true);
    try {
      const success = await verifyAndAddContact(qrData.address, qrData.hash, passphrase);
      if (success) {
        setStep('success');
      } else {
        Alert.alert('口令不匹配', '输入的口令与对方设置的不一致，请确认。');
      }
    } catch (error: any) {
      Alert.alert('确认失败', error.message || '请重试');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'scan':
        return (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>📷</Text>
              <Text style={styles.infoTitle}>扫描二维码</Text>
              <Text style={styles.infoDescription}>
                扫描对方分享的可信关系二维码，{'\n'}然后输入对方告知你的口令来确认关系。
              </Text>
            </View>

            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleScanQR}>
              <Text style={styles.scanIcon}>📷</Text>
              <Text style={styles.scanText}>点击扫描二维码</Text>
            </TouchableOpacity>
          </>
        );

      case 'verify':
        return (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>🤝</Text>
              <Text style={styles.infoTitle}>确认可信关系</Text>
              <Text style={styles.infoDescription}>
                二维码扫描成功，输入对方分享给你的口令来确认关系。
              </Text>
            </View>

            <View style={styles.addressCard}>
              <Text style={styles.addressLabel}>对方地址</Text>
              <Text style={styles.addressValue}>
                {qrData ? shortenAddress(qrData.address) : ''}
              </Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>口令</Text>
              <TextInput
                style={styles.input}
                placeholder="输入对方分享的口令"
                value={passphrase}
                onChangeText={setPassphrase}
                secureTextEntry
                placeholderTextColor="#666"
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>确认关系</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setStep('scan');
                setQrData(null);
                setPassphrase('');
              }}>
              <Text style={styles.secondaryButtonText}>重新扫描</Text>
            </TouchableOpacity>
          </>
        );

      case 'success':
        return (
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>可信关系已建立</Text>
            <Text style={styles.successText}>
              你和 {qrData ? shortenAddress(qrData.address) : '对方'} 已互为可信联系人，可以互相转账。
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate('Contacts')}>
              <Text style={styles.buttonText}>查看联系人</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {renderStep()}
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
  infoCard: {
    backgroundColor: '#2a2a4e',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  infoIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  scanButton: {
    backgroundColor: '#2a2a4e',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  scanIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  scanText: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },
  addressCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  addressLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  addressValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a4e',
    padding: 16,
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#2a2a4e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  successIcon: {
    fontSize: 64,
    color: '#4ade80',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
});
