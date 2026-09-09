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
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useWallet} from '../hooks/useWallet';
import {PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL} from '@solana/web3.js';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Transfer'>;
};

export default function TransferScreen({navigation}: Props) {
  const {publicKey, connection, signAndSendTransaction} = useWallet();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number>(0);

  React.useEffect(() => {
    loadBalance();
  }, [publicKey]);

  const loadBalance = async () => {
    if (!publicKey) return;
    try {
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  const validateInputs = (): boolean => {
    if (!recipient) {
      Alert.alert('错误', '请输入收款地址');
      return false;
    }
    try {
      new PublicKey(recipient);
    } catch {
      Alert.alert('错误', '收款地址格式无效');
      return false;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('错误', '请输入有效的转账金额');
      return false;
    }
    if (numAmount > balance) {
      Alert.alert('错误', '余额不足');
      return false;
    }
    return true;
  };

  const handleTransfer = async () => {
    if (!validateInputs()) return;
    if (!publicKey) {
      Alert.alert('错误', '钱包未连接');
      return;
    }

    setLoading(true);
    try {
      // Create transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(recipient),
          lamports: parseFloat(amount) * LAMPORTS_PER_SOL,
        }),
      );

      // Get latest blockhash
      const {blockhash} = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign and send
      const signature = await signAndSendTransaction(transaction);
      
      Alert.alert(
        '转账成功',
        `交易签名: ${signature.slice(0, 20)}...`,
        [{text: '确定', onPress: () => navigation.goBack()}],
      );
    } catch (error: any) {
      console.error('Transfer failed:', error);
      Alert.alert('转账失败', error.message || '请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>可用余额</Text>
          <Text style={styles.balanceAmount}>{balance.toFixed(4)} SOL</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>收款地址</Text>
          <TextInput
            style={styles.input}
            placeholder="输入 Solana 钱包地址"
            value={recipient}
            onChangeText={setRecipient}
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>转账金额 (SOL)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholderTextColor="#666"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleTransfer}
            disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? '处理中...' : '确认转账'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.warning}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            请确认对方是你的可信联系人。转账后无法撤回。
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
  balanceCard: {
    backgroundColor: '#2a2a4e',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
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
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warning: {
    flexDirection: 'row',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#fbbf24',
    lineHeight: 20,
  },
});
