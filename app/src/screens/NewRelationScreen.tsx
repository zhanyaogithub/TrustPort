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
  NativeModules,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useWallet} from '../hooks/useWallet';
import {useContract} from '../hooks/useContract';
import {PublicKey} from '@solana/web3.js';
import Clipboard from '@react-native-clipboard/clipboard';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NewRelation'>;
};

type Step = 'address' | 'passphrase' | 'confirm' | 'success';

export default function NewRelationScreen({navigation}: Props) {
  const {publicKey} = useWallet();
  const {initRelationship} = useContract();
  const [step, setStep] = useState<Step>('address');
  const [otherAddress, setOtherAddress] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validateAddress = (addr: string): boolean => {
    try {
      new PublicKey(addr);
      return true;
    } catch {
      return false;
    }
  };

  const handleScanQR = async () => {
    try {
      const QRScanner = NativeModules.QRScanner;
      if (!QRScanner) {
        Alert.alert('错误', 'QR 扫描模块不可用');
        return;
      }
      const result = await QRScanner.scan();
      if (result && validateAddress(result)) {
        setOtherAddress(result);
        Alert.alert('扫描成功', `地址: ${result.slice(0, 8)}...${result.slice(-4)}`);
      } else if (result) {
        Alert.alert('无效地址', '扫描到的内容不是有效的 Solana 地址');
      }
    } catch (error: any) {
      if (error.code !== 'SCAN_CANCELLED') {
        Alert.alert('扫描失败', error.message || '请重试');
      }
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const content = await Clipboard.getString();
      if (!content || content.trim().length === 0) {
        Alert.alert('剪贴板为空', '请先复制一个 Solana 钱包地址');
        return;
      }
      const trimmed = content.trim();
      if (validateAddress(trimmed)) {
        setOtherAddress(trimmed);
        Alert.alert('粘贴成功', `地址: ${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`);
      } else {
        Alert.alert('无效地址', `剪贴板内容不是有效的 Solana 地址:\n${trimmed.slice(0, 30)}...`);
      }
    } catch (error: any) {
      Alert.alert('错误', '无法读取剪贴板内容');
    }
  };

  const handleNext = () => {
    if (step === 'address') {
      if (!validateAddress(otherAddress)) {
        Alert.alert('错误', '请输入有效的 Solana 地址');
        return;
      }
      if (publicKey && otherAddress === publicKey.toString()) {
        Alert.alert('错误', '不能与自己建立可信关系');
        return;
      }
      setStep('passphrase');
    } else if (step === 'passphrase') {
      if (passphrase.length < 6) {
        Alert.alert('错误', '密码短语至少需要 6 个字符');
        return;
      }
      setStep('confirm');
    } else if (step === 'confirm') {
      if (passphrase !== confirmPassphrase) {
        Alert.alert('错误', '两次输入的密码短语不一致');
        return;
      }
      // Generate hash and submit to chain
      submitRelationship();
    }
  };

  const submitRelationship = async () => {
    setSubmitting(true);
    try {
      await initRelationship(otherAddress, passphrase);
      setStep('success');
    } catch (error: any) {
      Alert.alert('错误', error.message || '创建关系失败，请重试');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'address':
        return (
          <>
            <Text style={styles.stepTitle}>输入对方地址</Text>
            <Text style={styles.stepDescription}>
              输入你要建立可信关系的对方 Solana 钱包地址
            </Text>
            <TextInput
              style={styles.input}
              placeholder="例如: 7xKX...abc1"
              value={otherAddress}
              onChangeText={setOtherAddress}
              placeholderTextColor="#666"
            />
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleScanQR}>
                <Text style={styles.actionButtonIcon}>📷</Text>
                <Text style={styles.actionButtonText}>扫描二维码</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handlePasteFromClipboard}>
                <Text style={styles.actionButtonIcon}>📋</Text>
                <Text style={styles.actionButtonText}>从剪贴板粘贴</Text>
              </TouchableOpacity>
            </View>
          </>
        );
      case 'passphrase':
        return (
          <>
            <Text style={styles.stepTitle}>设置密码短语</Text>
            <Text style={styles.stepDescription}>
              设置一个只有你们双方知道的密码短语。对方需要输入相同的短语才能确认关系。
            </Text>
            <TextInput
              style={styles.input}
              placeholder="输入密码短语"
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry
              placeholderTextColor="#666"
            />
          </>
        );
      case 'confirm':
        return (
          <>
            <Text style={styles.stepTitle}>确认密码短语</Text>
            <Text style={styles.stepDescription}>
              请再次输入密码短语以确认
            </Text>
            <TextInput
              style={styles.input}
              placeholder="再次输入密码短语"
              value={confirmPassphrase}
              onChangeText={setConfirmPassphrase}
              secureTextEntry
              placeholderTextColor="#666"
            />
          </>
        );
      case 'success':
        return (
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>关系已创建</Text>
            <Text style={styles.successText}>
              请将密码短语通过安全渠道告知对方。对方确认后，你们即可进行受保护转账。
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => navigation.navigate('Contacts')}>
              <Text style={styles.successButtonText}>查看联系人</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {step !== 'success' && (
          <>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressDot,
                  {backgroundColor: '#6366f1'},
                ]}
              />
              <View style={styles.progressLine} />
              <View
                style={[
                  styles.progressDot,
                  step !== 'address' && {backgroundColor: '#6366f1'},
                ]}
              />
              <View style={styles.progressLine} />
              <View
                style={[
                  styles.progressDot,
                  step === 'confirm' && {backgroundColor: '#6366f1'},
                ]}
              />
            </View>
            {renderStep()}
            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={submitting}>
              <Text style={styles.buttonText}>
                {submitting ? '提交中...' : step === 'confirm' ? '提交' : '下一步'}
              </Text>
            </TouchableOpacity>
          </>
        )}
        {step === 'success' && renderStep()}
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
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#444',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#444',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#2a2a4e',
    padding: 16,
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
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
  successButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  successButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#2a2a4e',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  actionButtonIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  actionButtonText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
});
