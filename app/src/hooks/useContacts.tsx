import React, {createContext, useContext, useState, useCallback, ReactNode, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {sha256} from '@noble/hashes/sha256';
import {bytesToHex} from '@noble/hashes/utils';

const CONTACTS_KEY = 'trustport_contacts';

export interface ContactRecord {
  address: string;
  passphraseHash: string;
  createdAt: number;
  remark?: string;
}

interface ContactsContextType {
  contacts: ContactRecord[];
  loading: boolean;
  refreshContacts: () => Promise<void>;
  addContact: (address: string, passphrase: string) => Promise<void>;
  verifyAndAddContact: (address: string, expectedHash: string, passphrase: string) => Promise<boolean>;
  removeContact: (address: string) => Promise<void>;
  updateRemark: (address: string, remark: string) => Promise<void>;
  hasContact: (address: string) => boolean;
  computeHash: (passphrase: string) => string;
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

/**
 * Compute SHA-256 hash of a passphrase, returned as hex string.
 * Both parties must use the same passphrase to get the same hash.
 */
function computePassphraseHash(passphrase: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(passphrase);
  const hash = sha256(data);
  return bytesToHex(hash);
}

interface ContactsProviderProps {
  children: ReactNode;
}

export function ContactsProvider({children}: ContactsProviderProps) {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshContacts = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(CONTACTS_KEY);
      if (data) {
        const parsed: ContactRecord[] = JSON.parse(data);
        setContacts(parsed);
      } else {
        setContacts([]);
      }
    } catch (error: any) {
      console.error('[useContacts] Failed to load contacts:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  const saveContacts = async (list: ContactRecord[]) => {
    try {
      await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
      setContacts(list);
    } catch (error: any) {
      console.error('[useContacts] Failed to save contacts:', error.message);
    }
  };

  /**
   * Add a contact by computing SHA-256 hash from passphrase and storing locally.
   * Called after the user generates a QR code to share.
   */
  const addContact = useCallback(async (address: string, passphrase: string) => {
    const hash = computePassphraseHash(passphrase);
    const existing = contacts.filter(c => c.address !== address);
    const newContact: ContactRecord = {
      address,
      passphraseHash: hash,
      createdAt: Date.now(),
    };
    await saveContacts([newContact, ...existing]);
    console.log('[useContacts] Contact added:', address.slice(0, 8));
  }, [contacts]);

  /**
   * Verify passphrase hash against expected hash from scanned QR code, then add contact.
   * Returns true if hash matches and contact was saved successfully.
   */
  const verifyAndAddContact = useCallback(async (
    address: string,
    expectedHash: string,
    passphrase: string,
  ): Promise<boolean> => {
    const hash = computePassphraseHash(passphrase);
    if (hash !== expectedHash) {
      return false;
    }
    const existing = contacts.filter(c => c.address !== address);
    const newContact: ContactRecord = {
      address,
      passphraseHash: hash,
      createdAt: Date.now(),
    };
    await saveContacts([newContact, ...existing]);
    console.log('[useContacts] Contact verified and added:', address.slice(0, 8));
    return true;
  }, [contacts]);

  const removeContact = useCallback(async (address: string) => {
    const updated = contacts.filter(c => c.address !== address);
    await saveContacts(updated);
    console.log('[useContacts] Contact removed:', address.slice(0, 8));
  }, [contacts]);

  const hasContact = useCallback((address: string): boolean => {
    return contacts.some(c => c.address === address);
  }, [contacts]);

  const updateRemark = useCallback(async (address: string, remark: string) => {
    const updated = contacts.map(c =>
      c.address === address ? {...c, remark: remark || undefined} : c
    );
    await saveContacts(updated);
    console.log('[useContacts] Remark updated:', address.slice(0, 8), '->', remark);
  }, [contacts]);

  const value: ContactsContextType = {
    contacts,
    loading,
    refreshContacts,
    addContact,
    verifyAndAddContact,
    removeContact,
    updateRemark,
    hasContact,
    computeHash: computePassphraseHash,
  };

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

export function useContacts() {
  const context = useContext(ContactsContext);
  if (context === undefined) {
    throw new Error('useContacts must be used within a ContactsProvider');
  }
  return context;
}
