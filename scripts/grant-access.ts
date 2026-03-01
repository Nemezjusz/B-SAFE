// grant-access.ts — Admin script to grant a user access to a door
// Usage: ts-node grant-access.ts
//
// Required from user's mobile app (via QR code or API):
//   1. userPublicKey — their Solana pubkey (base58 string)
//   2. commitmentHex — their biometric commitment (64-char hex string)
//
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProvider, PROGRAM_ID, getDoorPDA, getGrantPDA } from "./config";
import IDL from "../target/idl/biometric_access.json";

async function grantAccess(
  doorId: number,
  userPublicKeyStr: string,  // base58 — from user's mobile app QR
  commitmentHex: string,     // 64-char hex — from user's mobile app QR
  expiresInDays?: number     // undefined = permanent access
) {
  const provider = getProvider();
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL as anchor.Idl, provider);

  // Parse inputs
  const userPubkey = new PublicKey(userPublicKeyStr);
  if (commitmentHex.length !== 64) {
    throw new Error("commitmentHex must be exactly 64 hex characters (32 bytes)");
  }
  const commitment = Array.from(Buffer.from(commitmentHex, "hex"));
  const [doorPDA]  = getDoorPDA(doorId);
  const [grantPDA] = getGrantPDA(userPubkey, doorId);

  const expiresAt = expiresInDays
    ? new anchor.BN(Math.floor(Date.now() / 1000) + expiresInDays * 86400)
    : null;

  const expiresStr = expiresInDays
    ? `in ${expiresInDays} days (${new Date(Date.now() + expiresInDays * 86400_000).toDateString()})`
    : "never (permanent)";

  console.log(`\nGranting access:`);
  console.log(`  Door ID   : ${doorId}`);
  console.log(`  Door PDA  : ${doorPDA.toBase58()}`);
  console.log(`  User      : ${userPublicKeyStr}`);
  console.log(`  Commitment: ${commitmentHex.slice(0, 16)}...`);
  console.log(`  Expires   : ${expiresStr}`);
  console.log(`  Grant PDA : ${grantPDA.toBase58()}`);

  const tx = await program.methods
    .grantAccess(new anchor.BN(doorId), commitment, expiresAt)
    .accounts({
      accessGrant: grantPDA,
      user: userPubkey,
      doorAccount: doorPDA,
      authority: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`\n✓ Access granted!`);
  console.log(`  Tx : ${tx}`);
  console.log(`  URL: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
}

// ── Edit values below, then run: ts-node grant-access.ts ──
grantAccess(
  1,                                    // door ID
  "PASTE_USER_PUBLIC_KEY_HERE",         // from user mobile app QR code
  "PASTE_64_CHAR_COMMITMENT_HEX_HERE",  // from user mobile app QR code
  90                                    // expires in 90 days (omit for permanent)
).catch(console.error);
