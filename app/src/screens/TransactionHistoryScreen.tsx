import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import {useWallet} from '../hooks/useWallet';
import {LAMPORTS_PER_SOL} from '@solana/web3.js';

interface TransactionItem {
  id: string;
  type: 'sent' | 'received';
  amount: number;
  otherAddress: string;
  timestamp: number;
  status: 'confirmed' | 'failed';
}

export default function TransactionHistoryScreen() {
  const {publicKey, connection} = useWallet();
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      // Get recent transaction signatures for this address
      const signatures = await connection.getSignaturesForAddress(
        publicKey,
        {limit: 50},
        'confirmed',
      );

      const items: TransactionItem[] = [];

      for (const sigInfo of signatures) {
        const signature = sigInfo.signature;
        const timestamp = sigInfo.blockTime || 0;
        const status = sigInfo.err ? 'failed' : 'confirmed';

        try {
          const tx = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx) continue;

          const accountKeys = tx.transaction.message.staticAccountKeys.map(k =>
            k.toString(),
          );
          const myAddress = publicKey.toString();
          const meta = tx.meta;
          if (!meta) continue;

          const myIdx = accountKeys.indexOf(myAddress);
          if (myIdx === -1) continue;

          const preBalance = meta.preBalances[myIdx] || 0;
          const postBalance = meta.postBalances[myIdx] || 0;
          const diff = postBalance - preBalance;
          const fee = meta.fee || 0;

          if (Math.abs(diff) <= fee) continue;

          const netChange = diff + fee;
          const amount = Math.abs(netChange) / LAMPORTS_PER_SOL;
          const otherAddr = accountKeys.find(a => a !== myAddress) || '';

          items.push({
            id: signature,
            type: netChange > 0 ? 'received' : 'sent',
            amount,
            otherAddress: otherAddr,
            timestamp,
            status,
          });
        } catch (e) {
          console.warn('Failed to parse transaction:', signature, e);
        }
      }

      // Sort by timestamp descending
      items.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(items);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const shortenAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const formatTime = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeLabel = (item: TransactionItem) => {
    return item.type === 'sent' ? '转账' : '收款';
  };

  const getTypeIcon = (item: TransactionItem) => {
    return item.type === 'sent' ? '↑' : '↓';
  };

  const getIconBg = (item: TransactionItem) => {
    return item.type === 'sent' ? '#ef4444' : '#4ade80';
  };

  const renderTransaction = ({item}: {item: TransactionItem}) => (
    <View style={styles.transactionCard}>
      <View style={[styles.transactionIcon, {backgroundColor: getIconBg(item)}]}>
        <Text style={styles.iconText}>{getTypeIcon(item)}</Text>
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionType}>{getTypeLabel(item)}</Text>
        {item.otherAddress ? (
          <Text style={styles.transactionAddress}>
            {shortenAddress(item.otherAddress)}
          </Text>
        ) : null}
        <Text style={styles.transactionTime}>{formatTime(item.timestamp)}</Text>
      </View>
      <View style={styles.transactionAmount}>
        <Text
          style={[
            styles.amount,
            item.type === 'sent' ? styles.sentAmount : styles.receivedAmount,
          ]}>
          {item.type === 'sent' ? '-' : '+'}{item.amount.toFixed(4)} SOL
        </Text>
        <Text
          style={[
            styles.status,
            item.status === 'confirmed' ? styles.confirmed : styles.failed,
          ]}>
          {item.status === 'confirmed' ? '已确认' : '失败'}
        </Text>
      </View>
    </View>
  );

  if (loading && transactions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>加载交易记录...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无交易记录</Text>
            <Text style={styles.emptyHint}>
              转账后，记录将显示在这里
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  list: {
    padding: 16,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a4e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  transactionAddress: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  transactionTime: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
  },
  sentAmount: {
    color: '#ef4444',
  },
  receivedAmount: {
    color: '#4ade80',
  },
  status: {
    fontSize: 11,
    marginTop: 4,
  },
  confirmed: {
    color: '#888',
  },
  failed: {
    color: '#ef4444',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  emptyHint: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
  },
});
