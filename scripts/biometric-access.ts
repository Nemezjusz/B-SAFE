/**
 * Biometric Access Control - TypeScript Client SDK
 * Use this in your mobile app (React Native) or admin dashboard.
 *
 * Dependencies:
 *   npm install @coral-xyz/anchor @solana/web3.js tweetnacl crypto-js
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import crypto from "crypto";
import { getLogPDA } from "./config";

// ============================================================
// Program ID — replace after deployment
// ============================================================
const PROGRAM_ID = new PublicKey(
  "8s6t3cCw56UjzijNk31FijSMA6NjESUYqrBNX6MAzceh"
);

// ============================================================
// PDA Derivation Helpers
// ============================================================

export function getDoorPDA(doorId: number): [PublicKey, number] {
  const doorIdBuf = Buffer.alloc(8);
  doorIdBuf.writeBigUInt64LE(BigInt(doorId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("door"), doorIdBuf],
    PROGRAM_ID
  );
}

export function getAccessGrantPDA(
  userPubkey: PublicKey,
  doorId: number
): [PublicKey, number] {
  const doorIdBuf = Buffer.alloc(8);
  doorIdBuf.writeBigUInt64LE(BigInt(doorId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("grant"), userPubkey.toBuffer(), doorIdBuf],
    PROGRAM_ID
  );
}

// ============================================================
// Biometric Key → Solana Keypair derivation
// ============================================================
// The mobile app runs the fuzzy extractor Rep() to reconstruct
// the 32-byte biometric key K from fingerprint + stored helper data.
// Then we derive a deterministic Solana keypair from K.
//
// IMPORTANT: K never leaves the device. The keypair is ephemeral
// and used only to sign the access transaction.

export function deriveKeypairFromBiometricKey(biometricKey: Buffer): Keypair {
  // KDF: HKDF-SHA256 to expand K into a 64-byte seed
  const info = Buffer.from("solana-access-keypair-v1");
  const salt = Buffer.from("biometric-door-access");

  // Simple HKDF using Node crypto (or react-native-fast-crypto in mobile)
  const prk = crypto
    .createHmac("sha256", salt)
    .update(biometricKey)
    .digest();
  const okm = crypto
    .createHmac("sha256", prk)
    .update(Buffer.concat([info, Buffer.from([1])]))
    .digest();

  // Solana Keypair from first 32 bytes of OKM
  return Keypair.fromSeed(Uint8Array.from(okm));
}

// ============================================================
// Biometric Commitment (stored on-chain during grant)
// ============================================================
// commitment = SHA-256(K || "biometric-commitment")
// This is a one-way binding: knowing commitment doesn't reveal K

export function computeBiometricCommitment(biometricKey: Buffer): Buffer {
  return crypto
    .createHash("sha256")
    .update(Buffer.concat([biometricKey, Buffer.from("biometric-commitment")]))
    .digest();
}

// ============================================================
// Proof for access attempt
// ============================================================
// proof = SHA-256(commitment XOR nonce)
// The program verifies the same computation on-chain

export function computeAccessProof(
  commitment: Buffer,
  nonce: Buffer
): Buffer {
  const xored = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xored[i] = commitment[i] ^ nonce[i];
  }
  return crypto.createHash("sha256").update(xored).digest();
}

// ============================================================
// Admin SDK
// ============================================================

export class BiometricAccessAdmin {
  program!: Program;
  provider: AnchorProvider;

  constructor(connection: Connection, adminWallet: anchor.Wallet, idl: anchor.Idl) {
    this.provider = new AnchorProvider(connection, adminWallet, {
      commitment: "confirmed",
    });
    anchor.setProvider(this.provider);
    this.program = new Program(idl, this.provider);
  }

  /** Register a new door on-chain */
  async registerDoor(
    doorId: number,
    name: string,
    location: string
  ): Promise<string> {
    const [doorPDA] = getDoorPDA(doorId);
    const doorIdBN = new BN(doorId);

    const tx = await this.program.methods
      .registerDoor(doorIdBN, name, location)
      .accounts({
        doorAccount: doorPDA,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`Door "${name}" registered. Tx: ${tx}`);
    console.log(`Door PDA: ${doorPDA.toBase58()}`);
    return tx;
  }

  /** Grant access to a user — requires their biometric commitment */
  async grantAccess(
    doorId: number,
    userPublicKey: PublicKey,
    biometricCommitment: Buffer,  // Provided by user's mobile app during enrollment
    expiresAt?: Date
  ): Promise<string> {
    const [doorPDA] = getDoorPDA(doorId);
    const [grantPDA] = getAccessGrantPDA(userPublicKey, doorId);
    const doorIdBN = new BN(doorId);

    const expiresAtTimestamp = expiresAt
      ? new BN(Math.floor(expiresAt.getTime() / 1000))
      : null;

    const tx = await this.program.methods
      .grantAccess(
        doorIdBN,
        Array.from(biometricCommitment),
        expiresAtTimestamp
      )
      .accounts({
        accessGrant: grantPDA,
        user: userPublicKey,
        doorAccount: doorPDA,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`Access granted. User: ${userPublicKey.toBase58()}, Door: ${doorId}`);
    console.log(`Grant PDA: ${grantPDA.toBase58()}, Tx: ${tx}`);
    return tx;
  }

  /** Revoke user access */
  async revokeAccess(doorId: number, userPublicKey: PublicKey): Promise<string> {
    const [doorPDA] = getDoorPDA(doorId);
    const [grantPDA] = getAccessGrantPDA(userPublicKey, doorId);

    const tx = await this.program.methods
      .revokeAccess()
      .accounts({
        accessGrant: grantPDA,
        doorAccount: doorPDA,
        authority: this.provider.wallet.publicKey,
      })
      .rpc();

    console.log(`Access revoked. User: ${userPublicKey.toBase58()}, Door: ${doorId}`);
    return tx;
  }

  /** Fetch all access logs for a door */
  async getAccessLogs(doorId: number) {
    const logs: any[] = await (this.program.account as any).accessLog.all([
      {
        memcmp: {
          offset: 8 + 32, // skip discriminator + user pubkey
          bytes: new BN(doorId).toBuffer("le", 8).toString("base64"),
        },
      },
    ]);
    return logs.map((l: any) => ({
      user: l.account.user.toBase58(),
      doorId: l.account.doorId.toNumber(),
      timestamp: new Date(l.account.timestamp.toNumber() * 1000),
      granted: l.account.granted,
      slot: l.account.slot.toNumber(),
    }));
  }
}

// ============================================================
// Mobile App SDK (User-side)
// ============================================================

export class BiometricAccessUser {
  program!: Program;
  provider: AnchorProvider;

  constructor(
    connection: Connection,
    userKeypair: Keypair, // derived from fingerprint
    idl: anchor.Idl
  ) {
    const wallet = new anchor.Wallet(userKeypair);
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    anchor.setProvider(this.provider);
    this.program = new Program(idl, this.provider);
  }

  /**
   * Enrollment: called once during user registration.
   * Returns the biometric commitment to send to admin for on-chain grant.
   *
   * @param biometricKey - 32-byte key from fuzzy extractor Gen()
   */
  static enrollBiometric(biometricKey: Buffer): {
    commitment: Buffer;
    keypair: Keypair;
  } {
    const commitment = computeBiometricCommitment(biometricKey);
    const keypair = deriveKeypairFromBiometricKey(biometricKey);
    console.log("Enrollment complete:");
    console.log("  Solana pubkey:", keypair.publicKey.toBase58());
    console.log("  Commitment (share with admin):", commitment.toString("hex"));
    return { commitment, keypair };
  }

  /**
   * Access attempt: called when user tries to open a door.
   *
   * @param doorId - the door to open
   * @param biometricKey - 32-byte key reconstructed from fingerprint by Rep()
   * @param logIndex - monotonic counter tracked by the app (start at 0, increment each attempt)
   */
  async attemptAccess(doorId: number, biometricKey: Buffer, logIndex: number): Promise<string> {
    const keypair = deriveKeypairFromBiometricKey(biometricKey);
    const commitment = computeBiometricCommitment(biometricKey);

    // Generate fresh nonce
    const nonce = crypto.randomBytes(32);
    const proof = computeAccessProof(commitment, nonce);

    const [doorPDA] = getDoorPDA(doorId);
    const [grantPDA] = getAccessGrantPDA(keypair.publicKey, doorId);
    const doorIdBN = new BN(doorId);
    const logIndexBN = new BN(logIndex);

    const [logPDA] = getLogPDA(keypair.publicKey, logIndex);

    const tx = await this.program.methods
      .logAccessAttempt(
        doorIdBN,
        logIndexBN,
        Array.from(nonce),
        Array.from(proof),
        true // biometric verification succeeded locally
      )
      .accounts({
        accessLog: logPDA,
        accessGrant: grantPDA,
        doorAccount: doorPDA,
        user: keypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([keypair])
      .rpc();

    console.log(`Access logged on-chain. Door: ${doorId}, LogIndex: ${logIndex}, Tx: ${tx}`);
    return tx;
  }
}

// ============================================================
// Usage Example
// ============================================================
/*
// --- ENROLLMENT (Mobile App, first time) ---
const fingerprintKey = runFuzzyExtractorGen(fingerprintTemplate); // Returns K and stores H
const { commitment, keypair } = BiometricAccessUser.enrollBiometric(fingerprintKey);
// Send commitment + keypair.publicKey to admin out-of-band

// --- ADMIN GRANTS ACCESS ---
const admin = new BiometricAccessAdmin(connection, adminWallet);
await admin.registerDoor(1, "Server Room", "Building A, Floor 3");
await admin.grantAccess(1, keypair.publicKey, commitment);

// --- ACCESS ATTEMPT (Mobile App) ---
const fingerprintKeyReconstructed = runFuzzyExtractorRep(newScan, storedHelperData);
const user = new BiometricAccessUser(connection, keypair);
await user.attemptAccess(1, fingerprintKeyReconstructed);
*/
