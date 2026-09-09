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
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useContract} from '../hooks/useContract';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmRelation'>;

export default function ConfirmRelationScreen({navigation, route}: Props) {
  const {otherAddress} = route.params;
  const {confirmRelationship} = useContract();
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const handleConfirm = async () => {
    if (passphrase.length < 6) {
      Alert.alert('错误', '密码短语至少需要 6 个字符');
      return;
    }

    setLoading(true);
    try {
      await confirmRelationship(otherAddress, passphrase);
      Alert.alert('成功', '可信关系已激活！你们现在可以进行受保护转账。', [
        {text: '确定', onPress: () => navigation.goBack()},
      ]);
    } catch (error: any) {
      console.error('Confirm failed:', error);
      const message = error.message || '';
      if (message.includes('custom program error') || message.includes('0x12c')) {
        Alert.alert('确认失败', '密码短语不正确。请确认对方分享给你的密码短语。');
      } else if (message.includes('0x12d')) {
        Alert.alert('确认失败', '该关系已经处于激活状态。');
      } else {
        Alert.alert('确认失败', message || '请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🤝</Text>
          <Text style={styles.infoTitle}>确认可信关系</Text>
          <Text style={styles.infoDescription}>
            对方已发起可信关系请求。输入对方分享给你的密码短语来确认关系。
          </Text>
        </View>

        <View style={styles.addressCard}>
          <Text style={styles.addressLabel}>对方地址</Text>
          <Text style={styles.addressValue}>{shortenAddress(otherAddress)}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>密码短语</Text>
          <TextInput
            style={styles.input}
            placeholder="输入对方分享的密码短语"
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
            placeholderTextColor="#666"
            editable={!loading}
          />
          <Text style={styles.hint}>
            密码短语由对方在发起可信关系时设置，需要通过安全渠道告知你
          </Text>
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
    marginBottom: 20,
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
    lineHeight: 20,
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
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
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
});
