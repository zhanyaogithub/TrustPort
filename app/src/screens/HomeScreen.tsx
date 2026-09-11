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
  BackHandler,
  Image,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useWallet} from '../hooks/useWallet';
import {useContacts} from '../hooks/useContacts';
import {PublicKey, LAMPORTS_PER_SOL} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  decimals: number;
  logoURI?: string;
}

const TOKEN_META: {[mint: string]: {symbol: string; name: string; decimals: number; logoURI: string}} = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'},
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {symbol: 'USDT', name: 'Tether USD', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg'},
  'So11111111111111111111111111111111111111112': {symbol: 'WSOL', name: 'Wrapped SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'},
  'mSoLzY6H4nc4n618KgvFMV7gEL437KbMKg6U3BjB3nK': {symbol: 'mSOL', name: 'Marinade Staked SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzY6H4nc4n618KgvFMV7gEL437KbMKg6U3BjB3nK/logo.png'},
  '7dHbWXmci3dT8UFKYYZSSLaV8FzudSVL7kgB2xNgRPeA': {symbol: 'stSOL', name: 'Lido Staked SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7dHbWXmci3dT8UFKYYZSSLaV8FzudSVL7kgB2xNgRPeA/logo.png'},
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {symbol: 'BONK', name: 'Bonk', decimals: 5, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png'},
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {symbol: 'JUP', name: 'Jupiter', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png'},
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': {symbol: 'RAY', name: 'Raydium', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png'},
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': {symbol: 'WIF', name: 'dogwifhat', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm/logo.png'},
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': {symbol: 'PYTH', name: 'Pyth Network', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3/logo.svg'},
};

async function resolveTokenMeta(mint: string, connection: any): Promise<{symbol: string; name: string; decimals: number; logoURI: string | null}> {
  // 1. Check hardcoded map
  if (TOKEN_META[mint]) {
    return {...TOKEN_META[mint]};
  }
  // 2. Try Jupiter token list
  try {
    const resp = await fetch(`https://tokens.jup.ag/token/${mint}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data?.symbol && data?.decimals !== undefined) {
        return {
          symbol: data.symbol,
          name: data.name || data.symbol,
          decimals: data.decimals,
          logoURI: data.logoURI || null,
        };
      }
    }
  } catch (e) {}
  // 3. Try Metaplex on-chain metadata
  try {
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(), new PublicKey(mint).toBuffer()],
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'),
    );
    const info = await connection.getAccountInfo(metadataPda);
    if (info?.data && info.data.length > 100) {
      const buf = info.data;
      let off = 1 + 32 + 32; // key + update_authority + mint
      const readStr = (o: number) => {
        const len = buf.readUInt32LE(o);
        return {str: buf.slice(o + 4, o + 4 + len).toString('utf8').replace(/\0+$/, '').trim(), next: o + 4 + len};
      };
      const nameRes = readStr(off); off = nameRes.next;
      const symRes = readStr(off); off = symRes.next;
      const uriRes = readStr(off);
      return {symbol: symRes.str || mint.slice(0, 4), name: nameRes.str || mint.slice(0, 8), decimals: 9, logoURI: null};
    }
  } catch (e) {}
  return {symbol: mint.slice(0, 4) + '...', name: mint.slice(0, 8) + '...', decimals: 9, logoURI: null};
}

export default function HomeScreen({navigation}: Props) {
  const {publicKey, connection, disconnect} = useWallet();
  const {contacts} = useContacts();
  const [solBalance, setSolBalance] = useState<number>(0);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('SOL');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [prices, setPrices] = useState<{[key: string]: number}>({});
  const [assetFilter, setAssetFilter] = useState<string>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const lastTapTimeRef = useRef<number>(0);

  useEffect(() => {
    const init = async () => {
      const p = await fetchPrices();
      await loadAllBalances(p);
    };
    init();

    // Block Android back button on Home screen
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => backHandler.remove();
  }, [publicKey]);

  const trustedCount = contacts.length;

  const fetchPrices = async (): Promise<{[key: string]: number}> => {
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
      return p;
    } catch (e: any) {
      console.log('[fetchPrices] Failed, using fallback:', e.message);
      const fallback = {SOL: 150, USDC: 1, USDT: 1, WSOL: 150};
      setPrices(fallback);
      return fallback;
    }
  };

  const loadAllBalances = async (priceMap?: {[key: string]: number}) => {
    if (!publicKey) return;
    const p = priceMap || prices;
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

      // Build token list: show instantly, resolve unknown metadata in parallel
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

      // Add SPL tokens: known instantly, unknown as placeholder
      const unknownMints: {mint: string; amount: number; index: number}[] = [];
      for (const [mint, amount] of Object.entries(tokenMap)) {
        if (amount > 0) {
          const known = TOKEN_META[mint];
          if (known) {
            tokens.push({mint, symbol: known.symbol, name: known.name, amount, decimals: known.decimals, logoURI: known.logoURI});
          } else {
            unknownMints.push({mint, amount, index: tokens.length});
            tokens.push({mint, symbol: mint.slice(0, 4) + '...', name: '加载中...', amount, decimals: 9});
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

      console.log('[loadAllBalances] Total tokens displayed:', tokens.length);

      // Calculate total USD value (SOL is already in tokens array)
      let total = 0;
      for (const token of tokens) {
        const tokenPrice = p[token.symbol] || 0;
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
    await Promise.all([loadBalance(), fetchPrices()]);
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

  const FILTER_OPTIONS = [
    {key: 'all', label: '全部显示'},
    {key: 'hide_dust_1', label: '隐藏 < $1'},
    {key: 'hide_dust_10', label: '隐藏 < $10'},
    {key: 'hide_zero', label: '隐藏零余额'},
    {key: 'sort_value', label: '按价值排序'},
  ];

  const filteredTokens = React.useMemo(() => {
    let list = [...tokenBalances];
    switch (assetFilter) {
      case 'hide_dust_1':
        list = list.filter(t => (t.amount * (prices[t.symbol] || 0)) >= 1);
        break;
      case 'hide_dust_10':
        list = list.filter(t => (t.amount * (prices[t.symbol] || 0)) >= 10);
        break;
      case 'hide_zero':
        list = list.filter(t => t.amount > 0);
        break;
      case 'sort_value':
        list = list.sort((a, b) => (b.amount * (prices[b.symbol] || 0)) - (a.amount * (prices[a.symbol] || 0)));
        break;
    }
    return list;
  }, [tokenBalances, assetFilter, prices]);

  const currentFilterLabel = FILTER_OPTIONS.find(f => f.key === assetFilter)?.label || '全部显示';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarButton}>
              <Text style={styles.avatarText}>
                {publicKey ? publicKey.toString().slice(0, 1).toUpperCase() : '?'}
              </Text>
            </View>
            <Text style={styles.appTitle}>TrustPort</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAddressModal(true)}
            activeOpacity={0.7}>
            <Text style={styles.headerAddress}>
              {publicKey ? shortenAddress(publicKey.toString()) : ''}
            </Text>
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
            {tokenBalances.find(t => t.symbol === selectedCurrency)?.amount.toFixed(4) || '0.0000'} {selectedCurrency}
          </Text>
        </TouchableOpacity>

        {/* Token Balance List */}
        <View style={styles.tokenList}>
          <View style={styles.tokenListHeader}>
            <Text style={styles.tokenListTitle}>资产明细</Text>
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => setShowFilterModal(true)}>
              <Text style={styles.filterChipText}>{currentFilterLabel}</Text>
              <Text style={styles.filterChipArrow}> ▾</Text>
            </TouchableOpacity>
          </View>
          {filteredTokens.length > 0 ? filteredTokens.map((token) => (
            <View key={token.mint} style={styles.tokenRow}>
              <View style={styles.tokenIconWrap}>
                {token.logoURI ? (
                  <Image source={{uri: token.logoURI}} style={styles.tokenLogo} />
                ) : (
                  <Text style={styles.tokenIconText}>
                    {token.symbol.charAt(0)}
                  </Text>
                )}
              </View>
              <View style={styles.tokenInfo}>
                <Text style={styles.tokenName} numberOfLines={1}>{token.name}</Text>
                <Text style={styles.tokenAmount}>{token.symbol} · {token.amount.toFixed(token.amount < 1 ? 6 : 4)}</Text>
              </View>
              <Text style={styles.tokenUsd}>
                ${(token.amount * (prices[token.symbol] || 0)).toFixed(2)}
              </Text>
            </View>
          )) : (
            <View style={styles.emptyFilter}>
              <Text style={styles.emptyFilterText}>没有符合条件的资产</Text>
            </View>
          )}
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
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionText}>分享二维码</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ConfirmRelation')}>
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={styles.actionText}>扫码确认</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('TransactionHistory')}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionText}>记录</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.actionIcon}>⚙️</Text>
            <Text style={styles.actionText}>设置</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Profile Modal */}
      <Modal
        visible={showAddressModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddressModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.profileModalContent}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {publicKey ? publicKey.toString().slice(0, 1).toUpperCase() : '?'}
              </Text>
            </View>
            {publicKey && (
              <>
                <TouchableOpacity
                  onPress={() => {
                    Clipboard.setString(publicKey.toString());
                    Alert.alert('已复制', '地址已复制到剪贴板');
                  }}
                  activeOpacity={0.7}>
                  <Text style={styles.profileAddress}>{publicKey.toString()}</Text>
                  <Text style={styles.profileCopyHint}>点击复制地址</Text>
                </TouchableOpacity>
                <View style={styles.profileQRWrap}>
                  <QRCode
                    value={publicKey.toString()}
                    size={160}
                    color="#000"
                    backgroundColor="#fff"
                  />
                </View>
              </>
            )}
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={() => {
                setShowAddressModal(false);
                handleDisconnect();
              }}>
              <Text style={styles.disconnectButtonText}>断开钱包</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowAddressModal(false)}>
              <Text style={styles.modalCloseButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Asset Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity
          style={styles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}>
          <View style={styles.filterModalContent}>
            <Text style={styles.filterModalTitle}>筛选资产</Text>
            {FILTER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.filterOption,
                  assetFilter === opt.key && styles.filterOptionSelected,
                ]}
                onPress={() => {
                  setAssetFilter(opt.key);
                  setShowFilterModal(false);
                }}>
                <Text style={[
                  styles.filterOptionText,
                  assetFilter === opt.key && styles.filterOptionTextSelected,
                ]}>{opt.label}</Text>
                {assetFilter === opt.key && (
                  <Text style={styles.filterCheckmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
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
    paddingTop: 12,
    paddingBottom: 4,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  headerAddress: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'monospace',
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
    width: '31.3%',
    marginHorizontal: '1%',
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
  profileModalContent: {
    backgroundColor: '#2a2a4e',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: '90%',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileAddress: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  profileCopyHint: {
    fontSize: 11,
    color: '#6366f1',
    marginTop: 4,
    textAlign: 'center',
  },
  profileQRWrap: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  disconnectButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  disconnectButtonText: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tokenListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3a5e',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  filterChipText: {
    fontSize: 12,
    color: '#ccc',
  },
  filterChipArrow: {
    fontSize: 10,
    color: '#888',
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: '#2a2a4e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    marginBottom: 8,
  },
  filterOptionSelected: {
    backgroundColor: '#6366f1',
  },
  filterOptionText: {
    fontSize: 15,
    color: '#ccc',
  },
  filterOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  filterCheckmark: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyFilter: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyFilterText: {
    fontSize: 14,
    color: '#666',
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
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
});
