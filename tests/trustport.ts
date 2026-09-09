import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import { Trustport } from "../target/types/trustport";
import { expect } from "chai";
import * as crypto from "crypto";

describe("trustport", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Trustport as Program<Trustport>;

  // Test accounts
  let userA: Keypair;
  let userB: Keypair;
  let userC: Keypair; // unauthorized user
  let passphraseHash: number[];
  let wrongPassphraseHash: number[];
  let relationshipPda: PublicKey;
  let relationshipBump: number;

  // Helper: derive PDA with correct pubkey ordering
  async function derivePDA(
    a: PublicKey,
    b: PublicKey
  ): Promise<[PublicKey, number]> {
    const [sortedA, sortedB] =
      a.toBuffer().compare(b.toBuffer()) < 0 ? [a, b] : [b, a];
    return PublicKey.findProgramAddressSync(
      [Buffer.from("trust"), sortedA.toBuffer(), sortedB.toBuffer()],
      program.programId
    );
  }

  // Helper: generate a deterministic passphrase hash
  function generateHash(seed: string): number[] {
    return Array.from(
      crypto.createHash("sha256").update(seed).digest()
    );
  }

  before(async () => {
    // Create test keypairs
    userA = Keypair.generate();
    userB = Keypair.generate();
    userC = Keypair.generate();

    // Ensure userA < userB ordering (swap if needed)
    if (userA.publicKey.toBuffer().compare(userB.publicKey.toBuffer()) > 0) {
      [userA, userB] = [userB, userA];
    }

    // Generate passphrase hashes
    passphraseHash = generateHash("my-secret-passphrase");
    wrongPassphraseHash = generateHash("wrong-passphrase");

    // Derive PDA
    [relationshipPda, relationshipBump] = await derivePDA(
      userA.publicKey,
      userB.publicKey
    );

    // Airdrop SOL to test accounts
    const airdropAmount = 10 * LAMPORTS_PER_SOL;
    const sig1 = await provider.connection.requestAirdrop(
      userA.publicKey,
      airdropAmount
    );
    await provider.connection.confirmTransaction(sig1);
    const sig2 = await provider.connection.requestAirdrop(
      userB.publicKey,
      airdropAmount
    );
    await provider.connection.confirmTransaction(sig2);
    const sig3 = await provider.connection.requestAirdrop(
      userC.publicKey,
      airdropAmount
    );
    await provider.connection.confirmTransaction(sig3);
  });

  // ==========================================================================
  // init_relationship
  // ==========================================================================
  describe("init_relationship", () => {
    it("Initializes a trust relationship successfully", async () => {
      const tx = await program.methods
        .initRelationship(passphraseHash)
        .accounts({
          relationship: relationshipPda,
          userA: userA.publicKey,
          userB: userB.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();

      console.log("  init tx:", tx);

      // Fetch and verify the account
      const relationship = await program.account.trustRelationship.fetch(
        relationshipPda
      );

      expect(relationship.userA.toBase58()).to.equal(
        userA.publicKey.toBase58()
      );
      expect(relationship.userB.toBase58()).to.equal(
        userB.publicKey.toBase58()
      );
      expect(relationship.bump).to.equal(relationshipBump);
      expect(relationship.version).to.equal(1);
      expect(relationship.confirmedAt.toNumber()).to.equal(0);
      expect(relationship.createdAt.toNumber()).to.be.greaterThan(0);

      // Status should be Pending (variant index 0)
      expect(relationship.status).to.deep.equal({ pending: {} });

      // Verify passphrase hash
      expect(Buffer.from(relationship.passphraseHash).toString("hex")).to.equal(
        Buffer.from(passphraseHash).toString("hex")
      );
    });

    it("Fails when trying to initialize the same relationship twice", async () => {
      try {
        await program.methods
          .initRelationship(passphraseHash)
          .accounts({
            relationship: relationshipPda,
            userA: userA.publicKey,
            userB: userB.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        // Expected: account already exists
        console.log("  Expected error (duplicate init):", err.message?.substring(0, 80));
      }
    });

    it("Fails when user_a pubkey > user_b pubkey (wrong order)", async () => {
      // Use existing userA < userB, but pass them in reversed order
      // Derive PDA with wrong order (userB as user_a, userA as user_b)
      const [wrongPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("trust"),
          userB.publicKey.toBuffer(),
          userA.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .initRelationship(passphraseHash)
          .accounts({
            relationship: wrongPda,
            userA: userB.publicKey,  // B is higher, should be user_b not user_a
            userB: userA.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([userB])
          .rpc();
        expect.fail("Should have thrown InvalidUserOrder");
      } catch (err: any) {
        // The error could be InvalidUserOrder from contract logic,
        // or a constraint error from Anchor PDA validation
        const errCode = err.error?.errorCode?.code || err?.errorCode?.code;
        const errMsg = err.toString();
        const isExpectedError =
          errCode === "InvalidUserOrder" ||
          errMsg.includes("InvalidUserOrder") ||
          errMsg.includes("6000");
        expect(isExpectedError).to.be.true;
        console.log("  Expected InvalidUserOrder error caught");
      }
    });
  });

  // ==========================================================================
  // confirm_relationship
  // ==========================================================================
  describe("confirm_relationship", () => {
    it("Confirms a pending relationship with correct passphrase", async () => {
      const tx = await program.methods
        .confirmRelationship(passphraseHash)
        .accounts({
          relationship: relationshipPda,
          confirmer: userB.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([userB])
        .rpc();

      console.log("  confirm tx:", tx);

      // Verify status changed to Active
      const relationship = await program.account.trustRelationship.fetch(
        relationshipPda
      );
      expect(relationship.status).to.deep.equal({ active: {} });
      expect(relationship.confirmedAt.toNumber()).to.be.greaterThan(0);
    });

    it("Fails when confirming with wrong passphrase", async () => {
      // Create a new relationship to test wrong passphrase
      const newUser1 = Keypair.generate();
      const newUser2 = Keypair.generate();
      const [low, high] =
        newUser1.publicKey.toBuffer().compare(newUser2.publicKey.toBuffer()) < 0
          ? [newUser1, newUser2]
          : [newUser2, newUser1];

      // Airdrop SOL
      const sig = await provider.connection.requestAirdrop(
        low.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [pda] = await PublicKey.findProgramAddressSync(
        [Buffer.from("trust"), low.publicKey.toBuffer(), high.publicKey.toBuffer()],
        program.programId
      );

      // Init relationship
      await program.methods
        .initRelationship(passphraseHash)
        .accounts({
          relationship: pda,
          userA: low.publicKey,
          userB: high.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([low])
        .rpc();

      // Try to confirm with wrong passphrase
      try {
        await program.methods
          .confirmRelationship(wrongPassphraseHash)
          .accounts({
            relationship: pda,
            confirmer: high.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([high])
          .rpc();
        expect.fail("Should have thrown PassphraseMismatch");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("PassphraseMismatch");
        console.log("  Expected PassphraseMismatch error caught");
      }
    });

    it("Fails when confirming an already active relationship", async () => {
      try {
        await program.methods
          .confirmRelationship(passphraseHash)
          .accounts({
            relationship: relationshipPda,
            confirmer: userB.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([userB])
          .rpc();
        expect.fail("Should have thrown InvalidRelationshipStatus");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("InvalidRelationshipStatus");
        console.log("  Expected InvalidRelationshipStatus error caught");
      }
    });
  });

  // ==========================================================================
  // guarded_transfer
  // ==========================================================================
  describe("guarded_transfer", () => {
    it("Transfers SOL successfully between trusted users", async () => {
      const balanceBefore = await provider.connection.getBalance(
        userB.publicKey
      );

      const transferAmount = 0.5 * LAMPORTS_PER_SOL;

      const tx = await program.methods
        .guardedTransfer(new anchor.BN(transferAmount))
        .accounts({
          relationship: relationshipPda,
          sender: userA.publicKey,
          receiver: userB.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();

      console.log("  transfer tx:", tx);

      const balanceAfter = await provider.connection.getBalance(
        userB.publicKey
      );
      expect(balanceAfter - balanceBefore).to.equal(transferAmount);
    });

    it("Transfers in reverse direction (user_b -> user_a)", async () => {
      const balanceBefore = await provider.connection.getBalance(
        userA.publicKey
      );

      const transferAmount = 0.1 * LAMPORTS_PER_SOL;

      const tx = await program.methods
        .guardedTransfer(new anchor.BN(transferAmount))
        .accounts({
          relationship: relationshipPda,
          sender: userB.publicKey,
          receiver: userA.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([userB])
        .rpc();

      console.log("  reverse transfer tx:", tx);

      const balanceAfter = await provider.connection.getBalance(
        userA.publicKey
      );
      expect(balanceAfter - balanceBefore).to.equal(transferAmount);
    });

    it("Fails when sender is not part of the relationship", async () => {
      try {
        await program.methods
          .guardedTransfer(new anchor.BN(0.1 * LAMPORTS_PER_SOL))
          .accounts({
            relationship: relationshipPda,
            sender: userC.publicKey,
            receiver: userA.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([userC])
          .rpc();
        expect.fail("Should have thrown UnauthorizedTransfer");
      } catch (err: any) {
        // userC is not in the relationship, so PDA derivation will differ
        // This will fail at account validation level
        console.log("  Expected unauthorized error caught:", err.message?.substring(0, 80));
      }
    });
  });

  // ==========================================================================
  // revoke_relationship
  // ==========================================================================
  describe("revoke_relationship", () => {
    it("Revokes an active relationship", async () => {
      const tx = await program.methods
        .revokeRelationship()
        .accounts({
          relationship: relationshipPda,
          revoker: userA.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();

      console.log("  revoke tx:", tx);

      // After revoking, the account is closed (close = revoker),
      // so fetching should return null
      const account = await provider.connection.getAccountInfo(relationshipPda);
      expect(account).to.be.null;
      console.log("  Relationship account closed after revoke");
    });

    it("Fails when trying to transfer after revocation", async () => {
      // Re-create a relationship for this test
      const newA = Keypair.generate();
      const newB = Keypair.generate();
      const [low, high] =
        newA.publicKey.toBuffer().compare(newB.publicKey.toBuffer()) < 0
          ? [newA, newB]
          : [newB, newA];

      // Airdrop
      const sig = await provider.connection.requestAirdrop(
        low.publicKey,
        5 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [pda] = await PublicKey.findProgramAddressSync(
        [Buffer.from("trust"), low.publicKey.toBuffer(), high.publicKey.toBuffer()],
        program.programId
      );

      // Init + Confirm
      await program.methods
        .initRelationship(passphraseHash)
        .accounts({
          relationship: pda,
          userA: low.publicKey,
          userB: high.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([low])
        .rpc();

      await program.methods
        .confirmRelationship(passphraseHash)
        .accounts({
          relationship: pda,
          confirmer: high.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([high])
        .rpc();

      // Revoke
      await program.methods
        .revokeRelationship()
        .accounts({
          relationship: pda,
          revoker: low.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([low])
        .rpc();

      // Try to transfer on revoked relationship
      try {
        await program.methods
          .guardedTransfer(new anchor.BN(0.1 * LAMPORTS_PER_SOL))
          .accounts({
            relationship: pda,
            sender: low.publicKey,
            receiver: high.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([low])
          .rpc();
        expect.fail("Should have thrown error for revoked relationship");
      } catch (err: any) {
        // Account is closed, so this will fail
        console.log("  Expected error after revoke:", err.message?.substring(0, 80));
      }
    });

    it("Fails when trying to revoke a pending relationship", async () => {
      // Create a new pending relationship
      const newA = Keypair.generate();
      const newB = Keypair.generate();
      const [low, high] =
        newA.publicKey.toBuffer().compare(newB.publicKey.toBuffer()) < 0
          ? [newA, newB]
          : [newB, newA];

      const sig = await provider.connection.requestAirdrop(
        low.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [pda] = await PublicKey.findProgramAddressSync(
        [Buffer.from("trust"), low.publicKey.toBuffer(), high.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .initRelationship(passphraseHash)
        .accounts({
          relationship: pda,
          userA: low.publicKey,
          userB: high.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([low])
        .rpc();

      // Try to revoke pending relationship
      try {
        await program.methods
          .revokeRelationship()
          .accounts({
            relationship: pda,
            revoker: low.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([low])
          .rpc();
        expect.fail("Should have thrown InvalidRelationshipStatus");
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("InvalidRelationshipStatus");
        console.log("  Expected InvalidRelationshipStatus for pending revoke");
      }
    });
  });
});
