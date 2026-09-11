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
import {useContacts} from '../hooks/useContacts';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NewRelation'>;
};

export default function NewRelationScreen({navigation}: Props) {
  const {publicKey} = useWallet();
  const {computeHash, addContact} = useContacts();
  const [passphrase, setPassphrase] = useState('');
  const [qrGenerated, setQrGenerated] = useState(false);
  const [saving, setSaving] = useState(false);

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const getQRData = (): string => {
    if (!publicKey || !passphrase) return '';
    const hash = computeHash(passphrase);
    return JSON.stringify({
      v: 1,
      address: publicKey.toBase58(),
      hash: hash,
    });
  };

  const handleGenerate = () => {
    if (passphrase.length < 6) {
      Alert.alert('错误', '口令至少需要 6 个字符');
      return;
    }
    setQrGenerated(true);
  };

  const handleSaveToGallery = async () => {
    setSaving(true);
    try {
      const QRSave = NativeModules.QRSave;
      if (!QRSave) {
        Alert.alert('错误', '保存模块不可用');
        return;
      }
      const qrData = getQRData();
      const fileName = `TrustPort_${publicKey?.toBase58().slice(0, 8)}_${Date.now()}`;
      await QRSave.saveQRToGallery(qrData, fileName);
      Alert.alert('保存成功', '二维码已保存到相册');
    } catch (error: any) {
      console.error('[QRSave] Error:', error.message);
      Alert.alert('保存失败', error.message || '请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDone = async () => {
    // Save the contact locally (the initiator also keeps a record)
    if (publicKey && passphrase) {
      // We don't add ourself as a contact, just navigate back
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {!qrGenerated ? (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>🔑</Text>
              <Text style={styles.infoTitle}>设置口令</Text>
              <Text style={styles.infoDescription}>
                输入一个口令，系统会生成包含你钱包地址的二维码。{'\n'}
                将二维码和口令通过安全渠道分享给对方。
              </Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>口令</Text>
              <TextInput
                style={styles.input}
                placeholder="输入口令（至少 6 个字符）"
                value={passphrase}
                onChangeText={setPassphrase}
                secureTextEntry
                placeholderTextColor="#666"
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleGenerate}>
              <Text style={styles.buttonText}>生成二维码</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.qrContainer}>
              <Text style={styles.qrTitle}>你的可信关系二维码</Text>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={getQRData()}
                  size={240}
                  backgroundColor="#fff"
                  color="#000"
                />
              </View>
              <Text style={styles.qrAddress}>
                {publicKey ? shortenAddress(publicKey.toBase58()) : ''}
              </Text>
            </View>

            <View style={styles.tipCard}>
              <Text style={styles.tipText}>
                将此二维码和口令分享给对方。{'\n'}
                对方扫码并输入相同口令后即可建立可信关系。
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={handleSaveToGallery}
              disabled={saving}>
              <Text style={styles.buttonText}>
                {saving ? '保存中...' : '📷 保存到相册'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleDone}>
              <Text style={styles.secondaryButtonText}>完成</Text>
            </TouchableOpacity>
          </>
        )}
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
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  qrWrapper: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  qrAddress: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  tipCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  tipText: {
    fontSize: 14,
    color: '#a5b4fc',
    textAlign: 'center',
    lineHeight: 22,
  },
});
