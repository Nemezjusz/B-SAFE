// list-doors.ts — Overview of all doors and active grants on-chain
// Usage: ts-node list-doors.ts
import * as anchor from "@coral-xyz/anchor";
import { getProvider, PROGRAM_ID } from "./config";
import IDL from "../target/idl/biometric_access.json";

async function listAll() {
  const provider = getProvider();
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL as anchor.Idl, provider);

  const [doors, grants] = await Promise.all([
    (program.account as any).doorAccount.all(),
    (program.account as any).accessGrant.all(),
  ]);

  console.log("\n═══════════════════════════════════════════");
  console.log("  BIOMETRIC ACCESS CONTROL — SYSTEM STATUS");
  console.log("═══════════════════════════════════════════");

  console.log(`\n📚 DOORS (${doors.length} total)`);
  console.log("─".repeat(60));
  for (const d of (doors as any[]).sort((a: any, b: any) => a.account.doorId.toNumber() - b.account.doorId.toNumber())) {
    const activeGrants = (grants as any[]).filter(
      (g: any) => g.account.doorId.toNumber() === d.account.doorId.toNumber() && g.account.isActive
    ).length;
    console.log(`[#${d.account.doorId}] ${d.account.name}`);
    console.log(`       Location  : ${d.account.location}`);
    console.log(`       Active    : ${d.account.isActive ? "Yes" : "NO (disabled)"}`);
    console.log(`       Total uses: ${d.account.totalAccesses}`);
    console.log(`       Users with access: ${activeGrants}`);
    console.log(`       PDA: ${d.publicKey.toBase58()}`);
    console.log();
  }

  const activeGrants = (grants as any[]).filter((g: any) => g.account.isActive);
  const revokedGrants = (grants as any[]).filter((g: any) => !g.account.isActive);

  console.log(`\n🔑 ACTIVE GRANTS (${activeGrants.length})`);
  console.log("─".repeat(60));
  for (const g of activeGrants as any[]) {
    const exp = g.account.expiresAt
      ? new Date(g.account.expiresAt.toNumber() * 1000).toDateString()
      : "permanent";
    const expired =
      g.account.expiresAt &&
      g.account.expiresAt.toNumber() < Date.now() / 1000;
    console.log(
      `Door #${g.account.doorId}  |  User: ${g.account.user.toBase58().slice(0, 20)}...  |  Expires: ${exp}${expired ? "  ⚠ EXPIRED" : ""}  |  Uses: ${g.account.accessCount}`
    );
  }

  if (revokedGrants.length > 0) {
    console.log(`\n🔒 REVOKED GRANTS (${revokedGrants.length}) — audit trail`);
    console.log("─".repeat(60));
    for (const g of revokedGrants as any[]) {
      console.log(
        `Door #${g.account.doorId}  |  User: ${g.account.user.toBase58().slice(0, 20)}...  |  Revoked`
      );
    }
  }

  console.log("\n═══════════════════════════════════════════\n");
}

listAll().catch(console.error);
