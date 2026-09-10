import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useWallet} from '../hooks/useWallet';
import {useContract} from '../hooks/useContract';
import {LAMPORTS_PER_SOL} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

interface TokenBalance {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
}

// Common token mints on Solana (add more as needed)
const KNOWN_TOKENS: {[key: string]: {symbol: string; decimals: number}} = {
  // SOL is native, handled separately
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {symbol: 'USDC', decimals: 6},
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {symbol: 'USDT', decimals: 6},
  'So11111111111111111111111111111111111111112': {symbol: 'WSOL', decimals: 9},
  // Add SKR token mint here when available
  // 'SKR_MINT_ADDRESS': {symbol: 'SKR', decimals: 9},
};

export default function HomeScreen({navigation}: Props) {
  const {publicKey, connection, disconnect} = useWallet();
  const {refreshRelationships, getActiveCount, getPendingCount, loading} = useContract();
  const [solBalance, setSolBalance] = useState<number>(0);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('SOL');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [prices, setPrices] = useState<{[key: string]: number}>({});
  const lastTapTimeRef = useRef<number>(0);

  useEffect(() => {
    loadAllBalances();
    refreshRelationships();
    fetchPrices();
  }, [publicKey]);

  const trustedCount = getActiveCount();
  const pendingCount = getPendingCount();

  const fetchPrices = async () => {
    try {
      const resp = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin,tether&vs_currencies=usd'
      );
      const data = await resp.json();
      const p: {[key: string]: number} = {
        SOL: data?.solana?.usd || 0,
        USDC: data?.['usd-coin']?.usd || 1,
        USDT: data?.tether?.usd || 1,
        WSOL: data?.solana?.usd || 0,
      };
      setPrices(p);
      console.log('[fetchPrices] Prices loaded:', JSON.stringify(p));
    } catch (e: any) {
      console.log('[fetchPrices] Failed, using fallback:', e.message);
      // Fallback prices
      setPrices({SOL: 150, USDC: 1, USDT: 1, WSOL: 150});
    }
  };

  const loadAllBalances = async () => {
    if (!publicKey) return;
    try {
      // Load SOL balance
      const solBal = await connection.getBalance(publicKey);
      setSolBalance(solBal / LAMPORTS_PER_SOL);

      // Query ALL token accounts (both legacy Token and Token-2022 programs)
      const tokenMap: {[mint: string]: number} = {};

      for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
        try {
          const resp = await connection.getParsedTokenAccountsByOwner(publicKey, {programId});
          console.log(`[loadAllBalances] ${programId.toBase58().slice(0, 8)}... found ${resp.value.length} accounts`);
          for (const acc of resp.value) {
            const info = acc.account.data.parsed?.info;
            if (info?.mint && info?.tokenAmount) {
              const mint = info.mint;
              const amount = info.tokenAmount.uiAmount || 0;
              // If same mint exists in both programs, sum them
              tokenMap[mint] = (tokenMap[mint] || 0) + amount;
            }
          }
        } catch (e: any) {
          console.log(`[loadAllBalances] Token program query error: ${e.message}`);
        }
      }

      // Cross-reference with KNOWN_TOKENS — always show known tokens (0 if not found)
      const tokens: TokenBalance[] = [];
      for (const [mintAddress, tokenInfo] of Object.entries(KNOWN_TOKENS)) {
        const amount = tokenMap[mintAddress] || 0;
        if (amount > 0) {
          console.log(`[loadAllBalances] ${tokenInfo.symbol}: ${amount}`);
        }
        tokens.push({
          mint: mintAddress,
          symbol: tokenInfo.symbol,
          amount: amount,
          decimals: tokenInfo.decimals,
        });
      }

      // Also add any other tokens not in KNOWN_TOKENS
      for (const [mint, amount] of Object.entries(tokenMap)) {
        if (!KNOWN_TOKENS[mint] && amount > 0) {
          tokens.push({
            mint,
            symbol: mint.slice(0, 4) + '...',
            amount,
            decimals: 9, // default, may be inaccurate
          });
        }
      }

      setTokenBalances(tokens);
      console.log('[loadAllBalances] Total tokens displayed:', tokens.length);

      // Calculate total USD value
      const solPrice = prices['SOL'] || 0;
      let total = solBal / LAMPORTS_PER_SOL * solPrice;
      for (const token of tokens) {
        const tokenPrice = prices[token.symbol] || 0;
        total += token.amount * tokenPrice;
      }
      setTotalUsd(total);
    } catch (error: any) {
      console.error('Failed to load balances:', error.message);
    }
  };

  const loadBalance = async () => {
    await loadAllBalances();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBalance(), refreshRelationships(), fetchPrices()]);
    // Recalculate after prices are updated
    setTimeout(() => loadAllBalances(), 500);
    setRefreshing(false);
  };

  const handleDisconnect = async () => {
    await disconnect();
    navigation.navigate('Onboarding');
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const modalAddressTapRef = useRef<number>(0);

  const handleAddressPress = () => {
    if (!publicKey) return;

    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - lastTapTimeRef.current < DOUBLE_PRESS_DELAY) {
      // Double tap - show QR code modal
      setShowAddressModal(true);
      lastTapTimeRef.current = 0;
    } else {
      // Single tap - do nothing, wait for possible double tap
      lastTapTimeRef.current = now;
    }
  };

  const handleModalAddressPress = () => {
    if (!publicKey) return;

    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - modalAddressTapRef.current < DOUBLE_PRESS_DELAY) {
      // Double tap - copy to clipboard
      const address = publicKey.toString();
      Clipboard.setString(address);
      Alert.alert('已复制', `地址已复制到剪贴板`);
      modalAddressTapRef.current = 0;
    } else {
      modalAddressTapRef.current = now;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleAddressPress} activeOpacity={0.7}>
            <Text style={styles.greeting}>欢迎回来</Text>
            <Text style={styles.address}>
              {publicKey ? shortenAddress(publicKey.toString()) : ''}
            </Text>
            <Text style={styles.addressHint}>双击查看二维码</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDisconnect}>
            <Text style={styles.disconnectBtn}>断开</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.balanceCard}
          onPress={() => setShowCurrencyModal(true)}
          activeOpacity={0.8}>
          <Text style={styles.balanceLabel}>总资产估值</Text>
          <Text style={styles.balanceAmount}>
            ${totalUsd.toFixed(2)}
          </Text>
          <Text style={styles.balanceSubAmount}>
            {selectedCurrency === 'SOL' ? solBalance.toFixed(4) : 
             (tokenBalances.find(t => t.symbol === selectedCurrency)?.amount.toFixed(4) || '0.0000')} {selectedCurrency}
          </Text>
        </TouchableOpacity>

        {/* Token Balance List */}
        <View style={styles.tokenList}>
          <View style={styles.tokenListHeader}>
            <Text style={styles.tokenListTitle}>资产明细</Text>
          </View>
          <View style={styles.tokenRow}>
            <View style={styles.tokenIconWrap}>
              <Text style={styles.tokenIconText}>◎</Text>
            </View>
            <View style={styles.tokenInfo}>
              <Text style={styles.tokenName}>SOL</Text>
              <Text style={styles.tokenAmount}>{solBalance.toFixed(4)}</Text>
            </View>
            <Text style={styles.tokenUsd}>
              ${(solBalance * (prices['SOL'] || 0)).toFixed(2)}
            </Text>
          </View>
          {tokenBalances.map((token) => (
            <View key={token.mint} style={styles.tokenRow}>
              <View style={[styles.tokenIconWrap, styles.tokenIconAlt]}>
                <Text style={styles.tokenIconText}>
                  {token.symbol === 'USDC' ? '$' : token.symbol === 'USDT' ? '₮' : '●'}
                </Text>
              </View>
              <View style={styles.tokenInfo}>
                <Text style={styles.tokenName}>{token.symbol}</Text>
                <Text style={styles.tokenAmount}>{token.amount.toFixed(token.amount < 1 ? 6 : 2)}</Text>
              </View>
              <Text style={styles.tokenUsd}>
                ${(token.amount * (prices[token.symbol] || 0)).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{trustedCount}</Text>
            <Text style={styles.statLabel}>可信联系人</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{pendingCount}</Text>
            <Text style={styles.statLabel}>待处理</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Transfer', {})}>
            <Text style={styles.actionIcon}>💸</Text>
            <Text style={styles.actionText}>转账</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Contacts')}>
            <Text style={styles.actionIcon}>👥</Text>
            <Text style={styles.actionText}>联系人</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('NewRelation')}>
            <Text style={styles.actionIcon}>🤝</Text>
            <Text style={styles.actionText}>建立关系</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('TransactionHistory')}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionText}>记录</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settingsText}>⚙️ 设置</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Address QR Code Modal */}
      <Modal
        visible={showAddressModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddressModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>钱包地址</Text>
            {publicKey && (
              <>
                <QRCode
                  value={publicKey.toString()}
                  size={200}
                  color="#000"
                  backgroundColor="#fff"
                />
                <TouchableOpacity onPress={handleModalAddressPress} activeOpacity={0.7}>
                  <Text style={styles.modalAddress}>{publicKey.toString()}</Text>
                  <Text style={styles.modalAddressHint}>双击复制地址</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowAddressModal(false)}>
              <Text style={styles.modalCloseButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 14,
    color: '#888',
  },
  address: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disconnectBtn: {
    color: '#ef4444',
    fontSize: 14,
  },
  balanceCard: {
    backgroundColor: '#6366f1',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#2a2a4e',
    marginHorizontal: 5,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  actionButton: {
    width: '22%',
    marginHorizontal: '1.5%',
    backgroundColor: '#2a2a4e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#fff',
  },
  settingsButton: {
    margin: 20,
    padding: 16,
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    alignItems: 'center',
  },
  settingsText: {
    fontSize: 16,
    color: '#fff',
  },
  addressHint: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2a2a4e',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  modalAddress: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  modalAddressHint: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  modalCloseButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 8,
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  currencySelector: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  balanceSubAmount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 6,
  },
  tokenList: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    marginBottom: 16,
    paddingVertical: 8,
  },
  tokenListHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tokenListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tokenIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#9945FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenIconAlt: {
    backgroundColor: '#2775CA',
  },
  tokenIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  tokenInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tokenName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  tokenAmount: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  tokenUsd: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ccc',
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
});
