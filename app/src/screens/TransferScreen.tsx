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
  Image,
  NativeModules,
  Linking,
} from 'react-native';
import {NativeStackNavigationProp, NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useWallet} from '../hooks/useWallet';
import {useContacts} from '../hooks/useContacts';
import {PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddressSync, getAccount, createAssociatedTokenAccountIdempotentInstruction} from '@solana/spl-token';
import {TOKEN_META, resolveTokenMeta} from '../utils/tokenMeta';

interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  decimals: number;
  logoURI?: string;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Transfer'>;

export default function TransferScreen({navigation, route}: Props) {
  const {publicKey, connection, signAndSendTransaction} = useWallet();
  const {contacts} = useContacts();
  const [recipient, setRecipient] = useState(route.params?.contactAddress || '');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('SOL');
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [transferResult, setTransferResult] = useState<{success: boolean; message: string; signature?: string} | null>(null);

  // All contacts are trusted (confirmed via QR)
  const trustedContacts = contacts;

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
          // Token program query error, continue
        }
      }

      // Build token list: show instantly with placeholders, then resolve metadata in parallel
      const tokens: TokenBalance[] = [];
      // Add SOL as first token (known metadata)
      tokens.push({
        mint: 'native',
        symbol: 'SOL',
        name: 'Solana',
        amount: solBal / LAMPORTS_PER_SOL,
        decimals: 9,
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      });

      // Add SPL tokens with instant placeholder, resolve metadata in parallel
      const unknownMints: {mint: string; amount: number; index: number}[] = [];
      for (const [mint, entry] of Object.entries(tokenMap)) {
        if (entry.amount > 0) {
          const known = TOKEN_META[mint];
          if (known) {
            tokens.push({mint, symbol: known.symbol, name: known.name, amount: entry.amount, decimals: known.decimals, logoURI: known.logoURI});
          } else {
            unknownMints.push({mint, amount: entry.amount, index: tokens.length});
            tokens.push({mint, symbol: mint.slice(0, 4) + '...', name: '加载中...', amount: entry.amount, decimals: 9});
          }
        }
      }

      setTokenBalances([...tokens]); // Show immediately

      // Phase 2: Resolve unknown metadata in parallel
      if (unknownMints.length > 0) {
        const results = await Promise.all(unknownMints.map(u => resolveTokenMeta(u.mint, connection)));
        for (let i = 0; i < unknownMints.length; i++) {
          const meta = results[i];
          tokens[unknownMints[i].index] = {
            mint: unknownMints[i].mint,
            symbol: meta.symbol,
            name: meta.name,
            amount: unknownMints[i].amount,
            decimals: meta.decimals,
            logoURI: meta.logoURI || undefined,
          };
        }
        setTokenBalances([...tokens]); // Update with full metadata
      }

      // Filter out completely unknown tokens (can't resolve name from any source)
      const knownTokens = tokens.filter(t => {
        if (t.mint === 'native') return true;
        if (!t.name.endsWith('...')) return true;
        return false;
      });
      setTokenBalances(knownTokens);
    } catch (error) {
      console.error('Failed to load balances:', error);
    }
  };

  const handleScanQR = async () => {
    try {
      const result = await NativeModules.QRScanner.scan();
      if (result) {
        try {
          new PublicKey(result);
          setRecipient(result);
        } catch {
          Alert.alert('无效地址', '扫描的内容不是有效的 Solana 钱包地址');
        }
      }
    } catch (e: any) {
      if (e.code !== 'SCAN_CANCELLED') {
        Alert.alert('扫码失败', e.message || '无法识别二维码');
      }
    }
  };

  const handleMaxAmount = () => {
    const token = tokenBalances.find(t => t.symbol === selectedCurrency);
    if (!token) return;
    if (selectedCurrency === 'SOL') {
      const max = Math.max(0, token.amount - 0.005);
      setAmount(max.toFixed(9));
    } else {
      setAmount(token.amount.toString());
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
    
    // Check balance based on selected currency
    const currentBalance = selectedCurrency === 'SOL' 
      ? solBalance 
      : (tokenBalances.find(t => t.symbol === selectedCurrency)?.amount || 0);
    
    if (numAmount > currentBalance) {
      Alert.alert('错误', `${selectedCurrency} 余额不足`);
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
        // Regular SOL transfer using SystemProgram
        const {blockhash} = await connection.getLatestBlockhash();
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(recipient),
            lamports: Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL),
          })
        );
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;
        signature = await signAndSendTransaction(transaction);
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
        const {blockhash: splBlockhash} = await connection.getLatestBlockhash();
        const transaction = new Transaction();
        instructions.forEach((instr: any) => transaction.add(instr));
        transaction.recentBlockhash = splBlockhash;
        transaction.feePayer = publicKey;

        signature = await signAndSendTransaction(transaction);
      }

      setTransferResult({
        success: true,
        message: `转账 ${amount} ${selectedCurrency} 成功`,
        signature: signature,
      });
    } catch (error: any) {
      console.error('Transfer failed:', error);
      setTransferResult({
        success: false,
        message: error.message || '转账失败，请重试',
      });
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
            {tokenBalances.find(t => t.symbol === selectedCurrency)?.amount.toFixed(4) || '0.0000'}
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
              onPress={handleScanQR}>
              <Text style={styles.contactPickerButtonText}>📷</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactPickerButton}
              onPress={() => setShowContactPicker(true)}>
              <Text style={styles.contactPickerButtonText}>👤</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>转账金额 ({selectedCurrency})</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholderTextColor="#666"
            />
            <TouchableOpacity
              style={styles.maxButton}
              onPress={handleMaxAmount}>
              <Text style={styles.maxButtonText}>MAX</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.maxHint}>
            可用: {tokenBalances.find(t => t.symbol === selectedCurrency)?.amount.toFixed(4) || '0.0000'} {selectedCurrency}
          </Text>

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
            建议仅向可信联系人转账，避免被骗。
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

            <ScrollView style={{maxHeight: 400}}>
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
                <View style={styles.currencyLeft}>
                  <View style={styles.currencyIconWrap}>
                    {token.logoURI ? (
                      <Image source={{uri: token.logoURI}} style={styles.currencyLogo} />
                    ) : (
                      <Text style={styles.tokenIconText}>{token.symbol.charAt(0)}</Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.currencyName}>{token.name}</Text>
                    <Text style={styles.currencySymbolSmall}>{token.symbol}</Text>
                  </View>
                </View>
                <Text style={styles.currencyBalance}>{token.amount.toFixed(4)}</Text>
              </TouchableOpacity>
            ))}

            {tokenBalances.length === 0 && (
              <Text style={styles.noTokensText}>暂无代币</Text>
            )}
            </ScrollView>

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

            {trustedContacts.length === 0 ? (
              <Text style={styles.noTokensText}>暂无可信联系人</Text>
            ) : (
              <FlatList
                data={trustedContacts}
                keyExtractor={item => item.address}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.contactPickerItem}
                    onPress={() => {
                      setRecipient(item.address);
                      setShowContactPicker(false);
                    }}>
                    <View style={styles.contactPickerAvatar}>
                      <Text style={styles.contactPickerAvatarText}>
                        {item.address.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.contactPickerInfo}>
                      <Text style={styles.contactPickerName}>
                        {item.remark || `${item.address.slice(0, 6)}...${item.address.slice(-4)}`}
                      </Text>
                      <Text style={styles.contactPickerHint}>
                        {item.remark ? `${item.address.slice(0, 6)}...${item.address.slice(-4)}` : '可信联系人'}
                      </Text>
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

      {/* Transfer Result Overlay */}
      <Modal
        visible={transferResult !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (transferResult?.success) {
            navigation.goBack();
          } else {
            setTransferResult(null);
          }
        }}>
        <View style={styles.resultOverlay}>
          <View style={styles.resultCard}>
            <Text style={[styles.resultIcon, transferResult?.success ? styles.resultIconSuccess : styles.resultIconFail]}>
              {transferResult?.success ? '✓' : '✕'}
            </Text>
            <Text style={styles.resultTitle}>
              {transferResult?.success ? '转账成功' : '转账失败'}
            </Text>
            <Text style={styles.resultMessage}>{transferResult?.message}</Text>
            {transferResult?.signature && (
              <>
                <Text style={styles.resultSignature}>
                  签名: {transferResult.signature.slice(0, 16)}...
                </Text>
                <TouchableOpacity
                  style={styles.explorerLink}
                  onPress={() => Linking.openURL('https://solscan.io/tx/' + transferResult.signature)}>
                  <Text style={styles.explorerLinkText}>在 Solana Explorer 中查看 ↗</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={[styles.resultButton, transferResult?.success ? styles.resultButtonSuccess : styles.resultButtonFail]}
              onPress={() => {
                if (transferResult?.success) {
                  navigation.goBack();
                } else {
                  setTransferResult(null);
                }
              }}>
              <Text style={styles.resultButtonText}>
                {transferResult?.success ? '完成' : '重试'}
              </Text>
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
  amountRow: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 8,
  },
  amountInput: {
    flex: 1,
    backgroundColor: '#2a2a4e',
    padding: 16,
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
  },
  maxButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maxButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  maxHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
    marginLeft: 4,
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
  tokenIconText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3a3a5e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currencyLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  currencyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  currencySymbolSmall: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
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
  resultOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  resultCard: {
    backgroundColor: '#2a2a4e',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  resultIcon: {
    fontSize: 64,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  resultIconSuccess: {
    color: '#4ade80',
  },
  resultIconFail: {
    color: '#ef4444',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  resultMessage: {
    fontSize: 15,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  resultSignature: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 24,
  },
  explorerLink: {
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 8,
  },
  explorerLinkText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
  resultButton: {
    marginTop: 16,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
  },
  resultButtonSuccess: {
    backgroundColor: '#4ade80',
  },
  resultButtonFail: {
    backgroundColor: '#ef4444',
  },
  resultButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
