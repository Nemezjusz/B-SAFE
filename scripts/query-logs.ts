// query-logs.ts — View immutable access logs for a door from the blockchain
// Usage: ts-node query-logs.ts
import * as anchor from "@coral-xyz/anchor";
import { getProvider, PROGRAM_ID } from "./config";
import IDL from "../target/idl/biometric_access.json";

async function queryLogs(doorId?: number) {
  const provider = getProvider();
  anchor.setProvider(provider);
  const program = new anchor.Program(IDL as anchor.Idl, provider);

  console.log(`\nFetching access logs${doorId !== undefined ? ` for door #${doorId}` : " (all doors)"}...`);

  const allLogs: any[] = await (program.account as any).accessLog.all();
  const logs = doorId !== undefined
    ? allLogs.filter((l: any) => l.account.doorId.toNumber() === doorId)
    : allLogs;

  // Sort newest first
  logs.sort((a: any, b: any) => b.account.timestamp.toNumber() - a.account.timestamp.toNumber());

  if (logs.length === 0) {
    console.log("  No logs found.");
    return;
  }

  const granted = logs.filter((l: any) => l.account.granted).length;
  const denied  = logs.length - granted;

  console.log(`\nTotal: ${logs.length} attempts  |  Granted: ${granted}  |  Denied: ${denied}`);
  console.log("─".repeat(80));
  console.log(
    "Timestamp".padEnd(26) +
    "Door".padEnd(7) +
    "User".padEnd(20) +
    "Result"
  );
  console.log("─".repeat(80));

  for (const log of logs as any[]) {
    const ts     = new Date(log.account.timestamp.toNumber() * 1000).toISOString();
    const door   = `#${log.account.doorId.toNumber()}`.padEnd(7);
    const user   = (log.account.user.toBase58().slice(0, 16) + "...").padEnd(20);
    const status = log.account.granted ? "✓ GRANTED" : "✗ DENIED ";
    console.log(`${ts}  ${door}${user}${status}`);
  }
  console.log("─".repeat(80));
}

// Run with a specific door ID or omit for all doors
queryLogs(1).catch(console.error);
// queryLogs().catch(console.error);  // all doors
