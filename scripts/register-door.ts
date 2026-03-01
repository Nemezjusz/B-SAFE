// register-door.ts — Admin script to register a physical door on-chain
// Usage: ts-node register-door.ts
import * as anchor from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { getProvider, PROGRAM_ID, getDoorPDA } from "./config";
import IDL from "../target/idl/biometric_access.json";

async function registerDoor(
  doorId: number,
  name: string,
  location: string
) {
  const provider = getProvider();
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL as anchor.Idl, provider);

  const [doorPDA] = getDoorPDA(doorId);

  console.log(`\nRegistering door #${doorId}`);
  console.log(`  Name     : ${name}`);
  console.log(`  Location : ${location}`);
  console.log(`  Door PDA : ${doorPDA.toBase58()}`);
  console.log(`  Authority: ${provider.wallet.publicKey.toBase58()}`);

  const tx = await program.methods
    .registerDoor(new anchor.BN(doorId), name, location)
    .accounts({
      doorAccount: doorPDA,
      authority: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`\n✓ Door registered successfully!`);
  console.log(`  Tx : ${tx}`);
  console.log(`  URL: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
}

// ── Edit these values, then run: ts-node register-door.ts ──
registerDoor(1, "Server Room A", "Building 3, Floor 2, Room 204").catch(
  console.error
);
