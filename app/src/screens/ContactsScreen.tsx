import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useContract, RelationshipRecord} from '../hooks/useContract';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Contacts'>;
};

export default function ContactsScreen({navigation}: Props) {
  const {relationships, loading, refreshRelationships} = useContract();

  useEffect(() => {
    refreshRelationships();
  }, []);

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const getStatusLabel = (r: RelationshipRecord) => {
    if (r.status === 'active') return '已激活';
    if (r.status === 'pending') return r.isInitiator ? '待对方确认' : '待我确认';
    return '已撤销';
  };

  const renderContact = ({item}: {item: RelationshipRecord}) => (
    <TouchableOpacity
      style={styles.contactCard}
      onPress={() =>
        navigation.navigate('Transfer', {
          contactAddress: item.otherUser.toString(),
        })
      }>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.otherUser.toString().slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>
          {shortenAddress(item.otherUser.toString())}
        </Text>
        <Text style={styles.contactAddress}>
          {item.isInitiator ? '我发起' : '对方发起'}
        </Text>
      </View>
      <View
        style={[
          styles.statusBadge,
          item.status === 'active'
            ? styles.activeBadge
            : item.status === 'pending'
            ? styles.pendingBadge
            : styles.revokedBadge,
        ]}>
        <Text
          style={[
            styles.statusText,
            item.status === 'active'
              ? styles.activeText
              : item.status === 'pending'
              ? styles.pendingText
              : styles.revokedText,
          ]}>
          {getStatusLabel(item)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && relationships.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={relationships.filter(r => r.status !== 'revoked')}
        renderItem={renderContact}
        keyExtractor={item => item.pda.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无可信联系人</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('NewRelation')}>
              <Text style={styles.addButtonText}>建立第一个可信关系</Text>
            </TouchableOpacity>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewRelation')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a4e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  contactAddress: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  pendingBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
  },
  revokedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    color: '#4ade80',
  },
  pendingText: {
    color: '#fbbf24',
  },
  revokedText: {
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
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    lineHeight: 30,
  },
});
