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
import {TRUSTPORT_PROGRAM_ID} from '../contract/trustport';
import {LAMPORTS_PER_SOL} from '@solana/web3.js';

interface TransactionItem {
  id: string; // signature
  type: 'sent' | 'received' | 'init_relation' | 'confirm_relation' | 'revoke_relation' | 'unknown';
  amount?: number; // in SOL, only for sent/received
  otherAddress?: string;
  timestamp: number; // unix seconds
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
          // Fetch full transaction
          const tx = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx) continue;

          const accountKeys = tx.transaction.message.staticAccountKeys.map(k =>
            k.toString(),
          );
          const myAddress = publicKey.toString();
          const programIdStr = TRUSTPORT_PROGRAM_ID.toString();

          // Check if this transaction involves our program
          const involvesProgram = accountKeys.includes(programIdStr);

          if (involvesProgram) {
            // Parse instruction data to determine type
            const instructions = tx.transaction.message.compiledInstructions;
            const programIdx = accountKeys.indexOf(programIdStr);

            for (const ix of instructions) {
              if (ix.programIdIndex !== programIdx) continue;

              const data = ix.data;
              // Get discriminator (first 8 bytes)
              if (data.length < 8) continue;
              const discriminator = Array.from(data.slice(0, 8));

              // init_relationship discriminator
              const initDisc = [69, 233, 202, 25, 110, 202, 72, 140];
              // confirm_relationship discriminator
              const confirmDisc = [65, 174, 126, 35, 247, 54, 218, 38];
              // revoke_relationship discriminator
              const revokeDisc = [32, 212, 32, 93, 29, 52, 193, 7];
              // guarded_transfer discriminator
              const transferDisc = [101, 14, 194, 73, 126, 140, 118, 221];

              const discMatch = (d: number[]) =>
                discriminator.length === 8 && d.every((v, i) => v === discriminator[i]);

              if (discMatch(initDisc)) {
                const otherAddr =
                  accountKeys.find(a => a !== myAddress && a !== programIdStr) || '';
                items.push({
                  id: signature,
                  type: 'init_relation',
                  otherAddress: otherAddr,
                  timestamp,
                  status,
                });
              } else if (discMatch(confirmDisc)) {
                const otherAddr =
                  accountKeys.find(a => a !== myAddress && a !== programIdStr) || '';
                items.push({
                  id: signature,
                  type: 'confirm_relation',
                  otherAddress: otherAddr,
                  timestamp,
                  status,
                });
              } else if (discMatch(revokeDisc)) {
                const otherAddr =
                  accountKeys.find(a => a !== myAddress && a !== programIdStr) || '';
                items.push({
                  id: signature,
                  type: 'revoke_relation',
                  otherAddress: otherAddr,
                  timestamp,
                  status,
                });
              } else if (discMatch(transferDisc)) {
                // Parse amount from instruction data (u64 LE after 8-byte discriminator)
                let amount = 0;
                if (data.length >= 16) {
                  const amountBytes = data.slice(8, 16);
                  let val = BigInt(0);
                  for (let i = 7; i >= 0; i--) {
                    val = (val << BigInt(8)) | BigInt(amountBytes[i]);
                  }
                  amount = Number(val) / LAMPORTS_PER_SOL;
                }

                // Determine sender/receiver from account keys
                // guarded_transfer accounts: [pda, sender(writable), receiver(writable), system_program]
                const senderIdx = 1;
                const receiverIdx = 2;
                const sender = accountKeys[senderIdx] || '';
                const receiver = accountKeys[receiverIdx] || '';
                const isSender = sender === myAddress;
                const otherAddr = isSender ? receiver : sender;

                items.push({
                  id: signature,
                  type: isSender ? 'sent' : 'received',
                  amount,
                  otherAddress: otherAddr,
                  timestamp,
                  status,
                });
              }
            }
          } else {
            // Regular SOL transfer (not through our program)
            // Check pre/post balances to determine direction
            const meta = tx.meta;
            if (!meta) continue;

            const myIdx = accountKeys.indexOf(myAddress);
            if (myIdx === -1) continue;

            const preBalance = meta.preBalances[myIdx] || 0;
            const postBalance = meta.postBalances[myIdx] || 0;
            const diff = postBalance - preBalance;
            const fee = meta.fee || 0;

            // Skip if it's just a fee payment (no real transfer)
            if (Math.abs(diff) <= fee) continue;

            const netChange = diff + fee; // add back fee to get actual transfer amount
            const amount = Math.abs(netChange) / LAMPORTS_PER_SOL;

            // Find the other party (first account that's not us and not the program)
            const otherAddr = accountKeys.find(a => a !== myAddress) || '';

            items.push({
              id: signature,
              type: netChange > 0 ? 'received' : 'sent',
              amount,
              otherAddress: otherAddr,
              timestamp,
              status,
            });
          }
        } catch (e) {
          // Skip transactions that fail to parse
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
    switch (item.type) {
      case 'sent':
        return '受保护转账';
      case 'received':
        return '受保护收款';
      case 'init_relation':
        return '发起可信关系';
      case 'confirm_relation':
        return '确认可信关系';
      case 'revoke_relation':
        return '撤销可信关系';
      default:
        return '交易';
    }
  };

  const getTypeIcon = (item: TransactionItem) => {
    switch (item.type) {
      case 'sent':
        return '↑';
      case 'received':
        return '↓';
      case 'init_relation':
        return '🤝';
      case 'confirm_relation':
        return '✓';
      case 'revoke_relation':
        return '✕';
      default:
        return '•';
    }
  };

  const getIconBg = (item: TransactionItem) => {
    if (item.type === 'sent') return '#ef4444';
    if (item.type === 'received') return '#4ade80';
    return '#6366f1';
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
        {item.amount !== undefined ? (
          <Text
            style={[
              styles.amount,
              item.type === 'sent' ? styles.sentAmount : styles.receivedAmount,
            ]}>
            {item.type === 'sent' ? '-' : '+'}{item.amount.toFixed(4)} SOL
          </Text>
        ) : null}
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
              发起受保护转账后，记录将显示在这里
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
