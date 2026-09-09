import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useWallet} from '../hooks/useWallet';
import {useContract} from '../hooks/useContract';
import {LAMPORTS_PER_SOL} from '@solana/web3.js';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export default function HomeScreen({navigation}: Props) {
  const {publicKey, connection, disconnect} = useWallet();
  const {refreshRelationships, getActiveCount, getPendingCount, loading} = useContract();
  const [balance, setBalance] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBalance();
    refreshRelationships();
  }, [publicKey]);

  const trustedCount = getActiveCount();
  const pendingCount = getPendingCount();

  const loadBalance = async () => {
    if (!publicKey) return;
    try {
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBalance(), refreshRelationships()]);
    setRefreshing(false);
  };

  const handleDisconnect = async () => {
    await disconnect();
    navigation.navigate('Onboarding');
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>欢迎回来</Text>
            <Text style={styles.address}>
              {publicKey ? shortenAddress(publicKey.toString()) : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={handleDisconnect}>
            <Text style={styles.disconnectBtn}>断开</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>可用余额</Text>
          <Text style={styles.balanceAmount}>
            {balance.toFixed(4)} SOL
          </Text>
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
});
