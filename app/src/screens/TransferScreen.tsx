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
  Modal,
  FlatList,
} from 'react-native';
import {NativeStackNavigationProp, NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useWallet} from '../hooks/useWallet';
import {useContract} from '../hooks/useContract';
import {PublicKey, LAMPORTS_PER_SOL} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddressSync, getAccount, createAssociatedTokenAccountIdempotentInstruction} from '@solana/spl-token';

interface TokenBalance {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
}

const KNOWN_TOKENS: {[key: string]: {symbol: string; decimals: number}} = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {symbol: 'USDC', decimals: 6},
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {symbol: 'USDT', decimals: 6},
  'So11111111111111111111111111111111111111112': {symbol: 'WSOL', decimals: 9},
};

type Props = NativeStackScreenProps<RootStackParamList, 'Transfer'>;

export default function TransferScreen({navigation, route}: Props) {
  const {publicKey, connection, signAndSendTransaction} = useWallet();
  const {guardedTransfer, hasActiveRelationship, refreshRelationships, relationships} = useContract();
  const [recipient, setRecipient] = useState(route.params?.contactAddress || '');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('SOL');
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);

  // Get active contacts for the picker
  const activeContacts = relationships.filter(r => r.status === 'active');

  React.useEffect(() => {
    loadAllBalances();
  }, [publicKey]);

  const loadAllBalances = async () => {
    if (!publicKey) return;
    try {
      // Load SOL balance
      const solBal = await connection.getBalance(publicKey);
      setSolBalance(solBal / LAMPORTS_PER_SOL);

      // Query ALL token accounts (both legacy Token and Token-2022 programs)
      const tokenMap: {[mint: string]: {amount: number; programId: string}} = {};

      for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
        try {
          const resp = await connection.getParsedTokenAccountsByOwner(publicKey, {programId});
          for (const acc of resp.value) {
            const info = acc.account.data.parsed?.info;
            if (info?.mint && info?.tokenAmount) {
              const mint = info.mint;
              const amount = info.tokenAmount.uiAmount || 0;
              if (!tokenMap[mint] || amount > tokenMap[mint].amount) {
                tokenMap[mint] = {amount, programId: programId.toBase58()};
              }
            }
          }
        } catch (e: any) {
          console.log(`[TransferScreen] Token program query error: ${e.message}`);
        }
      }

      // Cross-reference with KNOWN_TOKENS
      const tokens: TokenBalance[] = [];
      for (const [mintAddress, tokenInfo] of Object.entries(KNOWN_TOKENS)) {
        const entry = tokenMap[mintAddress];
        if (entry && entry.amount > 0) {
          tokens.push({
            mint: mintAddress,
            symbol: tokenInfo.symbol,
            amount: entry.amount,
            decimals: tokenInfo.decimals,
          });
        }
      }

      setTokenBalances(tokens);
    } catch (error) {
      console.error('Failed to load balances:', error);
    }
  };

  const loadBalance = async () => {
    await loadAllBalances();
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
    
    // Check balance based on selected currency
    const currentBalance = selectedCurrency === 'SOL' 
      ? solBalance 
      : (tokenBalances.find(t => t.symbol === selectedCurrency)?.amount || 0);
    
    if (numAmount > currentBalance) {
      Alert.alert('错误', `${selectedCurrency} 余额不足`);
      return false;
    }
    
    // Check if there's an active trust relationship with the recipient
    if (!hasActiveRelationship(recipient)) {
      Alert.alert(
        '无法转账',
        '你与收款方之间没有激活的可信关系。请先建立并确认可信关系后再转账。',
      );
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
      let signature: string;
      
      if (selectedCurrency === 'SOL') {
        // SOL transfer using guarded transfer
        signature = await guardedTransfer(
          recipient,
          parseFloat(amount),
        );
      } else {
        // SPL Token transfer
        const tokenInfo = tokenBalances.find(t => t.symbol === selectedCurrency);
        if (!tokenInfo) {
          throw new Error('Token info not found');
        }

        const mintAddress = new PublicKey(tokenInfo.mint);
        const recipientPk = new PublicKey(recipient);

        // Find sender's actual token account (check both programs)
        let fromTokenAccount: PublicKey | null = null;
        let usedProgramId = TOKEN_PROGRAM_ID;

        for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
          const ata = getAssociatedTokenAddressSync(mintAddress, publicKey, true, programId);
          try {
            const acc = await getAccount(connection, ata, undefined, programId);
            if (acc.amount > 0n) {
              fromTokenAccount = ata;
              usedProgramId = programId;
              console.log(`[Transfer] Found ${selectedCurrency} in ${programId === TOKEN_PROGRAM_ID ? 'Token' : 'Token-2022'}: ${acc.amount}`);
              break;
            }
          } catch (e) {
            // Account doesn't exist in this program, try next
          }
        }

        if (!fromTokenAccount) {
          throw new Error(`未找到 ${selectedCurrency} 代币账户`);
        }

        // Recipient's ATA — create with the same program as sender
        const toAta = getAssociatedTokenAddressSync(mintAddress, recipientPk, true, usedProgramId);

        let instructions: any[] = [];

        // Check if recipient's ATA exists
        try {
          await getAccount(connection, toAta, undefined, usedProgramId);
        } catch (error) {
          // ATA doesn't exist, create it
          instructions.push(
            createAssociatedTokenAccountIdempotentInstruction(
              publicKey,
              toAta,
              recipientPk,
              mintAddress,
              usedProgramId,
            )
          );
        }

        // Create transfer instruction
        const transferAmount = Math.floor(parseFloat(amount) * Math.pow(10, tokenInfo.decimals));
        instructions.push(
          createTransferInstruction(
            fromTokenAccount,
            toAta,
            publicKey,
            transferAmount,
            [],
            usedProgramId,
          )
        );

        // Build and send transaction
        const {Transaction} = require('@solana/web3.js');
        const transaction = new Transaction();
        instructions.forEach((instr: any) => transaction.add(instr));

        signature = await signAndSendTransaction(transaction);
      }

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
        <TouchableOpacity 
          style={styles.balanceCard}
          onPress={() => setShowCurrencyModal(true)}
          activeOpacity={0.8}>
          <Text style={styles.balanceLabel}>可用余额</Text>
          <Text style={styles.balanceAmount}>
            {selectedCurrency === 'SOL' ? solBalance.toFixed(4) : 
             (tokenBalances.find(t => t.symbol === selectedCurrency)?.amount.toFixed(4) || '0.0000')}
          </Text>
          <Text style={styles.currencySelector}>{selectedCurrency} ▼</Text>
        </TouchableOpacity>

        <View style={styles.form}>
          <Text style={styles.label}>收款地址</Text>
          <View style={styles.recipientRow}>
            <TextInput
              style={styles.recipientInput}
              placeholder="输入 Solana 钱包地址"
              value={recipient}
              onChangeText={setRecipient}
              placeholderTextColor="#666"
            />
            <TouchableOpacity
              style={styles.contactPickerButton}
              onPress={() => setShowContactPicker(true)}>
              <Text style={styles.contactPickerButtonText}>👤</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>转账金额 ({selectedCurrency})</Text>
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
          <Text style={styles.warningIcon}>🛡️</Text>
          <Text style={styles.warningText}>
            此转账受可信关系保护。只有与你有激活可信关系的联系人才能接收。
          </Text>
        </View>
      </ScrollView>

      {/* Currency Selection Modal */}
      <Modal
        visible={showCurrencyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}>
        <View style={styles.currencyModalOverlay}>
          <View style={styles.currencyModalContent}>
            <Text style={styles.currencyModalTitle}>选择币种</Text>
            
            {/* SOL Option */}
            <TouchableOpacity
              style={[
                styles.currencyOption,
                selectedCurrency === 'SOL' && styles.currencyOptionSelected,
              ]}
              onPress={() => {
                setSelectedCurrency('SOL');
                setShowCurrencyModal(false);
              }}>
              <Text style={styles.currencySymbol}>SOL</Text>
              <Text style={styles.currencyBalance}>{solBalance.toFixed(4)}</Text>
            </TouchableOpacity>

            {/* SPL Token Options */}
            {tokenBalances.map((token) => (
              <TouchableOpacity
                key={token.mint}
                style={[
                  styles.currencyOption,
                  selectedCurrency === token.symbol && styles.currencyOptionSelected,
                ]}
                onPress={() => {
                  setSelectedCurrency(token.symbol);
                  setShowCurrencyModal(false);
                }}>
                <Text style={styles.currencySymbol}>{token.symbol}</Text>
                <Text style={styles.currencyBalance}>{token.amount.toFixed(4)}</Text>
              </TouchableOpacity>
            ))}

            {tokenBalances.length === 0 && (
              <Text style={styles.noTokensText}>暂无其他代币</Text>
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCurrencyModal(false)}>
              <Text style={styles.modalCloseButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contact Picker Modal */}
      <Modal
        visible={showContactPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowContactPicker(false)}>
        <View style={styles.currencyModalOverlay}>
          <View style={styles.currencyModalContent}>
            <Text style={styles.currencyModalTitle}>选择联系人</Text>

            {activeContacts.length === 0 ? (
              <Text style={styles.noTokensText}>暂无已激活的可信联系人</Text>
            ) : (
              <FlatList
                data={activeContacts}
                keyExtractor={item => item.pda.toString()}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.contactPickerItem}
                    onPress={() => {
                      setRecipient(item.otherUser.toString());
                      setShowContactPicker(false);
                    }}>
                    <View style={styles.contactPickerAvatar}>
                      <Text style={styles.contactPickerAvatarText}>
                        {item.otherUser.toString().slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.contactPickerInfo}>
                      <Text style={styles.contactPickerName}>
                        {item.otherUser.toString().slice(0, 6)}...{item.otherUser.toString().slice(-4)}
                      </Text>
                      <Text style={styles.contactPickerHint}>可信联系人</Text>
                    </View>
                    <Text style={styles.contactPickerArrow}>›</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowContactPicker(false)}>
              <Text style={styles.modalCloseButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  recipientRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  recipientInput: {
    flex: 1,
    backgroundColor: '#2a2a4e',
    padding: 16,
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
  },
  contactPickerButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactPickerButtonText: {
    fontSize: 20,
  },
  contactPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 8,
  },
  contactPickerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactPickerAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  contactPickerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactPickerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  contactPickerHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  contactPickerArrow: {
    fontSize: 24,
    color: '#6366f1',
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
  currencySelector: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  currencyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  currencyModalContent: {
    backgroundColor: '#2a2a4e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    maxHeight: '70%',
  },
  currencyModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  currencyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 8,
  },
  currencyOptionSelected: {
    backgroundColor: '#6366f1',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  currencyBalance: {
    fontSize: 16,
    color: '#ccc',
  },
  noTokensText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    padding: 24,
  },
  modalCloseButton: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
