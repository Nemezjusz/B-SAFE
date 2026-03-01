// config.ts — Shared configuration for all scripts
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import fs from "fs";
import os from "os";
import path from "path";

// ── Program ID (deployed) ──────────────────────────────────────
export const PROGRAM_ID = new PublicKey(
  "8s6t3cCw56UjzijNk31FijSMA6NjESUYqrBNX6MAzceh"
);

// ── Cluster — change to "devnet" or "mainnet-beta" as needed ──
const CLUSTER = process.env.CLUSTER || "localnet";

const RPC_URL =
  process.env.RPC_URL ||
  (CLUSTER === "localnet" ? "http://127.0.0.1:8899" : `https://api.${CLUSTER}.solana.com`);

// ── Load wallet keypair from filesystem ───────────────────────
function loadWallet(): Keypair {
  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  const raw = fs.readFileSync(walletPath, "utf-8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

export function getProvider(): anchor.AnchorProvider {
  const connection = new Connection(RPC_URL, "confirmed");
  const keypair = loadWallet();
  const wallet = new anchor.Wallet(keypair);
  return new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

// ── PDA helpers ───────────────────────────────────────────────

export function getDoorPDA(doorId: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(doorId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("door"), buf],
    PROGRAM_ID
  );
}

export function getGrantPDA(
  userPubkey: PublicKey,
  doorId: number
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(doorId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("grant"), userPubkey.toBuffer(), buf],
    PROGRAM_ID
  );
}

export function getLogPDA(
  userPubkey: PublicKey,
  logIndex: number
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(logIndex));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("log"), userPubkey.toBuffer(), buf],
    PROGRAM_ID
  );
}
