// revoke-access.ts — Admin script to revoke a user's door access
// Usage: ts-node revoke-access.ts
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getProvider, PROGRAM_ID, getDoorPDA, getGrantPDA } from "./config";
import IDL from "../target/idl/biometric_access.json";

async function revokeAccess(doorId: number, userPublicKeyStr: string) {
  const provider = getProvider();
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL as anchor.Idl, provider);

  const userPubkey = new PublicKey(userPublicKeyStr);
  const [doorPDA]  = getDoorPDA(doorId);
  const [grantPDA] = getGrantPDA(userPubkey, doorId);

  console.log(`\nRevoking access:`);
  console.log(`  Door ID  : ${doorId}`);
  console.log(`  User     : ${userPublicKeyStr}`);
  console.log(`  Grant PDA: ${grantPDA.toBase58()}`);

  const tx = await program.methods
    .revokeAccess()
    .accounts({
      accessGrant: grantPDA,
      doorAccount: doorPDA,
      authority: provider.wallet.publicKey,
    })
    .rpc();

  console.log(`\n✓ Access revoked!`);
  console.log(`  Tx : ${tx}`);
  console.log(`  URL: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  console.log(`  Note: The AccessGrant PDA remains on-chain as an audit record.`);
}

// ── Edit values, then run: ts-node revoke-access.ts ──
revokeAccess(1, "PASTE_USER_PUBLIC_KEY_HERE").catch(console.error);
