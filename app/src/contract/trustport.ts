/**
 * TrustPort - Solana Contract Interface
 * 
 * Provides PDA derivation, instruction building, and account parsing
 * for the TrustPort on-chain program.
 */

import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  Connection,
  AccountInfo,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { BorshAccountsCoder, BorshInstructionCoder } from "@coral-xyz/anchor";
import { IDL, TrustRelationship, RelationshipStatus } from "../idl/trustport";
import { sha256 } from "@noble/hashes/sha256";
import * as Buffer from "buffer";

// Program ID
export const TRUSTPORT_PROGRAM_ID = new PublicKey(IDL.address);

// ============================================================================
// PDA Derivation
// ============================================================================

/**
 * Find the TrustRelationship PDA for a given pair of users.
 * User A must have the smaller pubkey (enforced by the contract).
 */
export async function findTrustRelationshipPDA(
  userA: PublicKey,
  userB: PublicKey
): Promise<[PublicKey, number]> {
  // Ensure correct ordering: userA < userB
  const [sortedA, sortedB] =
    userA.toBuffer().compare(userB.toBuffer()) < 0
      ? [userA, userB]
      : [userB, userA];

  return PublicKey.findProgramAddressSync(
    [
      Buffer.Buffer.from("trust"),
      sortedA.toBuffer(),
      sortedB.toBuffer(),
    ],
    TRUSTPORT_PROGRAM_ID
  );
}

// ============================================================================
// Instruction Builders
// ============================================================================

/**
 * Build initRelationship instruction
 */
export async function buildInitRelationshipIx(
  userA: PublicKey,
  userB: PublicKey,
  passphraseHash: number[]
): Promise<TransactionInstruction> {
  const [relationshipPDA] = await findTrustRelationshipPDA(userA, userB);

  return new TransactionInstruction({
    programId: TRUSTPORT_PROGRAM_ID,
    keys: [
      { pubkey: relationshipPDA, isSigner: false, isWritable: true },
      { pubkey: userA, isSigner: true, isWritable: true },
      { pubkey: userB, isSigner: false, isWritable: false },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    data: encodeInitRelationshipData(passphraseHash),
  });
}

/**
 * Build confirmRelationship instruction
 */
export async function buildConfirmRelationshipIx(
  confirmer: PublicKey,
  otherUser: PublicKey,
  passphraseHash: number[]
): Promise<TransactionInstruction> {
  const [relationshipPDA] = await findTrustRelationshipPDA(
    confirmer,
    otherUser
  );

  return new TransactionInstruction({
    programId: TRUSTPORT_PROGRAM_ID,
    keys: [
      { pubkey: relationshipPDA, isSigner: false, isWritable: true },
      { pubkey: confirmer, isSigner: true, isWritable: false },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    data: encodeConfirmRelationshipData(passphraseHash),
  });
}

/**
 * Build revokeRelationship instruction
 */
export async function buildRevokeRelationshipIx(
  revoker: PublicKey,
  otherUser: PublicKey
): Promise<TransactionInstruction> {
  const [relationshipPDA] = await findTrustRelationshipPDA(revoker, otherUser);

  return new TransactionInstruction({
    programId: TRUSTPORT_PROGRAM_ID,
    keys: [
      { pubkey: relationshipPDA, isSigner: false, isWritable: true },
      { pubkey: revoker, isSigner: true, isWritable: true },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    data: encodeRevokeRelationshipData(),
  });
}

/**
 * Build guardedTransfer instruction
 */
export async function buildGuardedTransferIx(
  sender: PublicKey,
  receiver: PublicKey,
  amountLamports: number
): Promise<TransactionInstruction> {
  const [relationshipPDA] = await findTrustRelationshipPDA(sender, receiver);

  return new TransactionInstruction({
    programId: TRUSTPORT_PROGRAM_ID,
    keys: [
      { pubkey: relationshipPDA, isSigner: false, isWritable: false },
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: receiver, isSigner: false, isWritable: true },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    data: encodeGuardedTransferData(amountLamports),
  });
}

// ============================================================================
// Account Fetching & Parsing
// ============================================================================

/**
 * Fetch and parse a TrustRelationship account
 */
export async function fetchTrustRelationship(
  connection: Connection,
  pda: PublicKey
): Promise<TrustRelationship | null> {
  const accountInfo = await connection.getAccountInfo(pda);
  if (!accountInfo) return null;
  return parseTrustRelationship(accountInfo);
}

/**
 * Parse TrustRelationship from AccountInfo
 */
export function parseTrustRelationship(
  accountInfo: AccountInfo<Buffer.Buffer>
): TrustRelationship | null {
  if (!accountInfo.owner.equals(TRUSTPORT_PROGRAM_ID)) return null;

  const data = accountInfo.data;
  // Skip 8-byte discriminator
  const offset = 8;

  const userA = new PublicKey(data.subarray(offset, offset + 32));
  const userB = new PublicKey(data.subarray(offset + 32, offset + 64));
  const passphraseHash = Array.from(
    data.subarray(offset + 64, offset + 96)
  );
  const statusByte = data[offset + 96];
  const createdAt = data.readBigInt64LE(offset + 97);
  const confirmedAt = data.readBigInt64LE(offset + 105);
  const bump = data[offset + 113];
  const version = data[offset + 114];

  const status: RelationshipStatus =
    statusByte === 0
      ? { pending: {} }
      : statusByte === 1
      ? { active: {} }
      : { revoked: {} };

  return {
    userA,
    userB,
    passphraseHash,
    status,
    createdAt: BigInt(createdAt) as any,
    confirmedAt: BigInt(confirmedAt) as any,
    bump,
    version,
  };
}

/**
 * Get all trust relationships for a user by scanning program accounts
 */
export async function getUserRelationships(
  connection: Connection,
  userPubkey: PublicKey
): Promise<{ pda: PublicKey; relationship: TrustRelationship }[]> {
  const accounts = await connection.getProgramAccounts(
    TRUSTPORT_PROGRAM_ID,
    {
      filters: [
        // Discriminator filter for TrustRelationship
        { memcmp: { offset: 0, bytes: "" } }, // Will be set below
      ],
    }
  );

  const results: { pda: PublicKey; relationship: TrustRelationship }[] = [];

  for (const { pubkey, account } of accounts) {
    const relationship = parseTrustRelationship(account);
    if (
      relationship &&
      (relationship.userA.equals(userPubkey) ||
        relationship.userB.equals(userPubkey))
    ) {
      results.push({ pda: pubkey, relationship });
    }
  }

  return results;
}

// ============================================================================
// Data Encoding (Borsh)
// ============================================================================

function encodeInitRelationshipData(
  passphraseHash: number[]
): Buffer.Buffer {
  // Discriminator (8 bytes) + passphrase_hash (32 bytes)
  const discriminator = Buffer.Buffer.from([69, 233, 202, 25, 110, 202, 72, 140]);
  const data = Buffer.Buffer.alloc(8 + 32);
  discriminator.copy(data, 0);
  Buffer.Buffer.from(passphraseHash).copy(data, 8);
  return data;
}

function encodeConfirmRelationshipData(
  passphraseHash: number[]
): Buffer.Buffer {
  const discriminator = Buffer.Buffer.from([65, 174, 126, 35, 247, 54, 218, 38]);
  const data = Buffer.Buffer.alloc(8 + 32);
  discriminator.copy(data, 0);
  Buffer.Buffer.from(passphraseHash).copy(data, 8);
  return data;
}

function encodeRevokeRelationshipData(): Buffer.Buffer {
  // Only discriminator, no args
  return Buffer.Buffer.from([32, 212, 32, 93, 29, 52, 193, 7]);
}

function encodeGuardedTransferData(amount: number): Buffer.Buffer {
  const discriminator = Buffer.Buffer.from([101, 14, 194, 73, 126, 140, 118, 221]);
  const data = Buffer.Buffer.alloc(8 + 8); // discriminator + u64
  discriminator.copy(data, 0);
  // Write amount as u64 LE
  const amountBuf = Buffer.Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(BigInt(amount));
  amountBuf.copy(data, 8);
  return data;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compute SHA-256 hash of passphrase + userA + userB (for init)
 * This is done client-side, never sent to chain in plaintext
 */
export async function computePassphraseHash(
  passphrase: string,
  userA: PublicKey,
  userB: PublicKey
): Promise<number[]> {
  const [sortedA, sortedB] =
    userA.toBuffer().compare(userB.toBuffer()) < 0
      ? [userA, userB]
      : [userB, userA];

  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);
  const combined = new Uint8Array([
    ...passphraseBytes,
    ...sortedA.toBuffer(),
    ...sortedB.toBuffer(),
  ]);

  return Array.from(sha256(combined));
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Get relationship status display text
 */
export function getStatusText(status: RelationshipStatus): string {
  if ("pending" in status) return "待确认";
  if ("active" in status) return "已激活";
  return "已撤销";
}

/**
 * Get relationship status color
 */
export function getStatusColor(status: RelationshipStatus): string {
  if ("pending" in status) return "#F59E0B"; // amber
  if ("active" in status) return "#10B981"; // green
  return "#EF4444"; // red
}
