import React, {createContext, useContext, useState, useCallback, ReactNode, useEffect} from 'react';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {useWallet} from './useWallet';
import {
  TRUSTPORT_PROGRAM_ID,
  findTrustRelationshipPDA,
  buildInitRelationshipIx,
  buildConfirmRelationshipIx,
  buildRevokeRelationshipIx,
  buildGuardedTransferIx,
  getStatusText,
  getStatusColor,
  solToLamports,
  lamportsToSol,
} from '../contract/trustport';
import {sha256} from '@noble/hashes/sha256';

// ============================================================================
// Base58 encoding utility (no external dependency needed)
// ============================================================================

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(bytes: Uint8Array): string {
  const zeroes: number[] = [];
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    zeroes.push(i);
  }
  let length = 0;
  const b58 = new Array(bytes.length * 2).fill(0);
  for (let i = zeroes.length; i < bytes.length; i++) {
    let carry = bytes[i];
    let j = 0;
    for (let k = b58.length - 1; k >= 0; k--, j++) {
      if (carry === 0 && j >= length) break;
      carry += 256 * b58[k];
      b58[k] = carry % 58;
      carry = (carry / 58) | 0;
    }
    length = j;
  }
  let it = b58.length - length;
  while (it < b58.length && b58[it] === 0) it++;
  let str = '1'.repeat(zeroes.length);
  for (; it < b58.length; it++) str += BASE58_ALPHABET[b58[it]];
  return str;
}

// TrustRelationship account discriminator (first 8 bytes of SHA256("account:TrustRelationship"))
const DISCRIMINATOR_BYTES = new Uint8Array([
  164, 132, 69, 226, 50, 147, 207, 214,
]);
const DISCRIMINATOR_B58 = encodeBase58(DISCRIMINATOR_BYTES);

// ============================================================================
// Types
// ============================================================================

export interface RelationshipRecord {
  pda: PublicKey;
  otherUser: PublicKey;
  status: 'pending' | 'active' | 'revoked';
  createdAt: number;
  confirmedAt: number;
  isInitiator: boolean; // whether current user initiated the relationship
}

interface ContractContextType {
  relationships: RelationshipRecord[];
  loading: boolean;
  refreshRelationships: () => Promise<void>;
  initRelationship: (
    otherAddress: string,
    passphrase: string,
  ) => Promise<string>;
  confirmRelationship: (
    otherAddress: string,
    passphrase: string,
  ) => Promise<string>;
  revokeRelationship: (otherAddress: string) => Promise<string>;
  guardedTransfer: (
    recipientAddress: string,
    amountSol: number,
  ) => Promise<string>;
  getActiveCount: () => number;
  getPendingCount: () => number;
  hasActiveRelationship: (address: string) => boolean;
}

const ContractContext = createContext<ContractContextType | undefined>(undefined);

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute SHA-256(passphrase + sortedUserA + sortedUserB)
 * Uses @noble/hashes for React Native compatibility
 */
function computePassphraseHash(
  passphrase: string,
  userA: PublicKey,
  userB: PublicKey,
): number[] {
  // Sort addresses (smaller first)
  const [sortedA, sortedB] =
    userA.toBuffer().compare(userB.toBuffer()) < 0
      ? [userA, userB]
      : [userB, userA];

  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  // Concatenate: passphrase + sortedUserA (32 bytes) + sortedUserB (32 bytes)
  const combined = new Uint8Array([
    ...passphraseBytes,
    ...sortedA.toBuffer(),
    ...sortedB.toBuffer(),
  ]);

  return Array.from(sha256(combined));
}

// ============================================================================
// Provider
// ============================================================================

interface ContractProviderProps {
  children: ReactNode;
}

export function ContractProvider({children}: ContractProviderProps) {
  const {publicKey, connection, signAndSendTransaction} = useWallet();
  const [relationships, setRelationships] = useState<RelationshipRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Load relationships when wallet connects
  useEffect(() => {
    if (publicKey) {
      refreshRelationships();
    } else {
      setRelationships([]);
    }
  }, [publicKey]);

  /**
   * Scan on-chain for all relationships involving the current user
   */
  const refreshRelationships = useCallback(async () => {
    if (!publicKey) return;
    
    // Check if contract module is properly loaded
    if (typeof TRUSTPORT_PROGRAM_ID === 'undefined' || !TRUSTPORT_PROGRAM_ID) {
      console.warn('[useContract] TRUSTPORT_PROGRAM_ID not loaded, skipping relationship query');
      return;
    }
    
    setLoading(true);
    try {
      // Get all program accounts with TrustRelationship discriminator
      const accounts = await connection.getProgramAccounts(
        TRUSTPORT_PROGRAM_ID,
        {
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: DISCRIMINATOR_B58,
              },
            },
          ],
        },
      );

      const records: RelationshipRecord[] = [];

      for (const {pubkey, account} of accounts) {
        try {
          const data = account.data;
          const offset = 8; // skip discriminator

          const userA = new PublicKey(data.subarray(offset, offset + 32));
          const userB = new PublicKey(data.subarray(offset + 32, offset + 64));
          const statusByte = data[offset + 96];
          const createdAt = Number(data.readBigInt64LE(offset + 97));
          const confirmedAt = Number(data.readBigInt64LE(offset + 105));

          // Check if current user is part of this relationship
          const isUserA = userA.equals(publicKey);
          const isUserB = userB.equals(publicKey);
          if (!isUserA && !isUserB) continue;

          const otherUser = isUserA ? userB : userA;
          const status =
            statusByte === 0
              ? 'pending'
              : statusByte === 1
              ? 'active'
              : 'revoked';

          records.push({
            pda: pubkey,
            otherUser,
            status,
            createdAt,
            confirmedAt,
            isInitiator: isUserA, // user_a is the initiator
          });
        } catch (e) {
          // Skip accounts that fail to parse
          console.warn('Failed to parse relationship account:', e);
        }
      }

      // Sort: active first, then pending, then revoked
      records.sort((a, b) => {
        const order = {active: 0, pending: 1, revoked: 2};
        return order[a.status] - order[b.status];
      });

      setRelationships(records);
    } catch (error) {
      console.error('Failed to load relationships:', error);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  /**
   * Initialize a new trust relationship
   */
  const initRelationship = useCallback(
    async (otherAddress: string, passphrase: string): Promise<string> => {
      if (!publicKey) throw new Error('Wallet not connected');

      const otherPubkey = new PublicKey(otherAddress);
      const hash = computePassphraseHash(passphrase, publicKey, otherPubkey);

      const instruction = await buildInitRelationshipIx(
        publicKey,
        otherPubkey,
        hash,
      );

      const transaction = new Transaction().add(instruction);
      const {blockhash} = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await signAndSendTransaction(transaction);
      await connection.confirmTransaction(signature, 'confirmed');

      // Refresh relationships after successful tx
      await refreshRelationships();
      return signature;
    },
    [publicKey, connection, signAndSendTransaction, refreshRelationships],
  );

  /**
   * Confirm a pending trust relationship
   */
  const confirmRelationship = useCallback(
    async (otherAddress: string, passphrase: string): Promise<string> => {
      if (!publicKey) throw new Error('Wallet not connected');

      const otherPubkey = new PublicKey(otherAddress);
      const hash = computePassphraseHash(passphrase, publicKey, otherPubkey);

      const instruction = await buildConfirmRelationshipIx(
        publicKey,
        otherPubkey,
        hash,
      );

      const transaction = new Transaction().add(instruction);
      const {blockhash} = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await signAndSendTransaction(transaction);
      await connection.confirmTransaction(signature, 'confirmed');

      await refreshRelationships();
      return signature;
    },
    [publicKey, connection, signAndSendTransaction, refreshRelationships],
  );

  /**
   * Revoke an active trust relationship
   */
  const revokeRelationship = useCallback(
    async (otherAddress: string): Promise<string> => {
      if (!publicKey) throw new Error('Wallet not connected');

      const otherPubkey = new PublicKey(otherAddress);
      const instruction = await buildRevokeRelationshipIx(
        publicKey,
        otherPubkey,
      );

      const transaction = new Transaction().add(instruction);
      const {blockhash} = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await signAndSendTransaction(transaction);
      await connection.confirmTransaction(signature, 'confirmed');

      await refreshRelationships();
      return signature;
    },
    [publicKey, connection, signAndSendTransaction, refreshRelationships],
  );

  /**
   * Transfer SOL via guarded_transfer (requires active relationship)
   */
  const guardedTransfer = useCallback(
    async (recipientAddress: string, amountSol: number): Promise<string> => {
      if (!publicKey) throw new Error('Wallet not connected');

      const recipientPubkey = new PublicKey(recipientAddress);
      const amountLamports = solToLamports(amountSol);

      const instruction = await buildGuardedTransferIx(
        publicKey,
        recipientPubkey,
        amountLamports,
      );

      const transaction = new Transaction().add(instruction);
      const {blockhash} = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await signAndSendTransaction(transaction);
      await connection.confirmTransaction(signature, 'confirmed');

      return signature;
    },
    [publicKey, connection, signAndSendTransaction],
  );

  // Utility functions
  const getActiveCount = useCallback(
    () => relationships.filter(r => r.status === 'active').length,
    [relationships],
  );

  const getPendingCount = useCallback(
    () => relationships.filter(r => r.status === 'pending').length,
    [relationships],
  );

  const hasActiveRelationship = useCallback(
    (address: string) =>
      relationships.some(
        r =>
          r.otherUser.toString() === address && r.status === 'active',
      ),
    [relationships],
  );

  const value: ContractContextType = {
    relationships,
    loading,
    refreshRelationships,
    initRelationship,
    confirmRelationship,
    revokeRelationship,
    guardedTransfer,
    getActiveCount,
    getPendingCount,
    hasActiveRelationship,
  };

  return (
    <ContractContext.Provider value={value}>{children}</ContractContext.Provider>
  );
}

export function useContract() {
  const context = useContext(ContractContext);
  if (context === undefined) {
    throw new Error('useContract must be used within a ContractProvider');
  }
  return context;
}
