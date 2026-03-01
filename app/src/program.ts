import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import IDL from "../../target/idl/biometric_access.json";

export const PROGRAM_ID = new PublicKey("8s6t3cCw56UjzijNk31FijSMA6NjESUYqrBNX6MAzceh");
export const CONNECTION = new Connection("http://127.0.0.1:8899", "confirmed");

export function getProgram(provider: anchor.AnchorProvider) {
  return new anchor.Program(IDL as anchor.Idl, provider);
}

export function getReadonlyProgram() {
  const wallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };
  const provider = new anchor.AnchorProvider(CONNECTION, wallet as any, { commitment: "confirmed" });
  return new anchor.Program(IDL as anchor.Idl, provider);
}

export function getDoorPDA(doorId: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(doorId));
  return PublicKey.findProgramAddressSync([Buffer.from("door"), buf], PROGRAM_ID);
}

export function getGrantPDA(userPubkey: PublicKey, doorId: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(doorId));
  return PublicKey.findProgramAddressSync([Buffer.from("grant"), userPubkey.toBuffer(), buf], PROGRAM_ID);
}

export type DoorAccount = {
  doorId: anchor.BN;
  name: string;
  location: string;
  authority: PublicKey;
  isActive: boolean;
  totalAccesses: anchor.BN;
};

export type AccessGrant = {
  user: PublicKey;
  doorId: anchor.BN;
  biometricCommitment: number[];
  grantedBy: PublicKey;
  grantedAt: anchor.BN;
  expiresAt: anchor.BN | null;
  isActive: boolean;
  accessCount: anchor.BN;
};

export type AccessLog = {
  user: PublicKey;
  doorId: anchor.BN;
  timestamp: anchor.BN;
  nonce: number[];
  granted: boolean;
  slot: anchor.BN;
};
