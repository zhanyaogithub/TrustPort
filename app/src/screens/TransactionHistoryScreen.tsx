import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TransactionHistory'>;
};

interface Transaction {
  id: string;
  type: 'sent' | 'received';
  amount: string;
  address: string;
  timestamp: string;
  status: 'confirmed' | 'pending';
}

export default function TransactionHistoryScreen({navigation}: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([
    // Mock data - will be loaded from chain
    {
      id: '1',
      type: 'sent',
      amount: '0.5',
      address: '7xKX...abc1',
      timestamp: '2024-09-09 14:30',
      status: 'confirmed',
    },
    {
      id: '2',
      type: 'received',
      amount: '1.2',
      address: '9yZy...def2',
      timestamp: '2024-09-08 10:15',
      status: 'confirmed',
    },
  ]);

  const renderTransaction = ({item}: {item: Transaction}) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionIcon}>
        <Text style={styles.iconText}>
          {item.type === 'sent' ? '↑' : '↓'}
        </Text>
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionType}>
          {item.type === 'sent' ? '已发送' : '已接收'}
        </Text>
        <Text style={styles.transactionAddress}>{item.address}</Text>
        <Text style={styles.transactionTime}>{item.timestamp}</Text>
      </View>
      <View style={styles.transactionAmount}>
        <Text
          style={[
            styles.amount,
            item.type === 'sent' ? styles.sentAmount : styles.receivedAmount,
          ]}>
          {item.type === 'sent' ? '-' : '+'}{item.amount} SOL
        </Text>
        <Text
          style={[
            styles.status,
            item.status === 'confirmed' ? styles.confirmed : styles.pending,
          ]}>
          {item.status === 'confirmed' ? '已确认' : '处理中'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无交易记录</Text>
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
    backgroundColor: '#6366f1',
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
  pending: {
    color: '#fbbf24',
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
});
