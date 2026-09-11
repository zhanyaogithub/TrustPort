import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useContacts, ContactRecord} from '../hooks/useContacts';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Contacts'>;
};

export default function ContactsScreen({navigation}: Props) {
  const {contacts, loading, refreshContacts, removeContact, updateRemark} = useContacts();
  const [remarkModal, setRemarkModal] = useState<{address: string; currentRemark: string} | null>(null);
  const [remarkInput, setRemarkInput] = useState('');

  useEffect(() => {
    refreshContacts();
  }, []);

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleContactPress = (item: ContactRecord) => {
    navigation.navigate('Transfer', {contactAddress: item.address});
  };

  const handleLongPress = (item: ContactRecord) => {
    Alert.alert(
      item.remark || shortenAddress(item.address),
      '选择操作',
      [
        {text: '取消', style: 'cancel'},
        {
          text: '修改备注',
          onPress: () => {
            setRemarkInput(item.remark || '');
            setRemarkModal({address: item.address, currentRemark: item.remark || ''});
          },
        },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '删除联系人',
              `确定要删除 ${item.remark || shortenAddress(item.address)} 吗？`,
              [
                {text: '取消', style: 'cancel'},
                {text: '删除', style: 'destructive', onPress: () => removeContact(item.address)},
              ],
            );
          },
        },
      ],
    );
  };

  const handleSaveRemark = async () => {
    if (remarkModal) {
      await updateRemark(remarkModal.address, remarkInput.trim());
      setRemarkModal(null);
      setRemarkInput('');
    }
  };

  const renderContact = ({item}: {item: ContactRecord}) => (
    <TouchableOpacity
      style={styles.contactCard}
      onPress={() => handleContactPress(item)}
      onLongPress={() => handleLongPress(item)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.remark || item.address).slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>
          {item.remark || shortenAddress(item.address)}
        </Text>
        <Text style={styles.contactAddress}>
          {shortenAddress(item.address)}
        </Text>
        <Text style={styles.contactDate}>
          {formatDate(item.createdAt)}
        </Text>
      </View>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>已信任</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && contacts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={contacts}
        renderItem={renderContact}
        keyExtractor={item => item.address}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🤝</Text>
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
        style={styles.scanFab}
        onPress={() => navigation.navigate('ConfirmRelation')}>
        <Text style={styles.fabText}>📷</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewRelation')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Remark Edit Modal */}
      <Modal
        visible={remarkModal !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRemarkModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>修改备注</Text>
            <TextInput
              style={styles.remarkInput}
              placeholder="输入备注名称"
              value={remarkInput}
              onChangeText={setRemarkInput}
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setRemarkModal(null)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveRemark}>
                <Text style={styles.modalSaveText}>保存</Text>
              </TouchableOpacity>
            </View>
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
    color: '#6366f1',
    marginTop: 2,
  },
  contactDate: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ade80',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
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
  scanFab: {
    position: 'absolute',
    right: 20,
    bottom: 88,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2a2a4e',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    lineHeight: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  remarkInput: {
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
