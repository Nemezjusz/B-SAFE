import { useState } from "react";
import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { getProgram, getDoorPDA, getGrantPDA, CONNECTION } from "../program";
import { ShieldCheck, PlusCircle, UserCheck, UserX, DoorOpen, CheckCircle, XCircle } from "lucide-react";

type Tab = "register" | "grant" | "revoke";
type Status = { ok: boolean; msg: string } | null;

function useAnchorProgram() {
  const anchorWallet = useAnchorWallet();
  if (!anchorWallet) return null;
  const provider = new AnchorProvider(CONNECTION, anchorWallet, { commitment: "confirmed" });
  return getProgram(provider);
}

function StatusBadge({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm mt-4 ${
        status.ok
          ? "bg-emerald-950 border border-emerald-800 text-emerald-400"
          : "bg-red-950 border border-red-800 text-red-400"
      }`}
    >
      {status.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
      <span className="font-mono break-all">{status.msg}</span>
    </div>
  );
}

function RegisterDoorForm({ program }: { program: anchor.Program }) {
  const wallet = useAnchorWallet()!;
  const [doorId, setDoorId] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const id = parseInt(doorId);
      const [doorPDA] = getDoorPDA(id);
      const tx = await program.methods
        .registerDoor(new anchor.BN(id), name, location)
        .accounts({
          doorAccount: doorPDA,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      setStatus({ ok: true, msg: `Door registered! Tx: ${tx}` });
      setDoorId(""); setName(""); setLocation("");
    } catch (e: any) {
      setStatus({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Door ID (number)</label>
          <input
            type="number" required value={doorId} onChange={(e) => setDoorId(e.target.value)}
            placeholder="e.g. 1"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Name (max 64 chars)</label>
          <input
            required maxLength={64} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Server Room A"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Location (max 128 chars)</label>
          <input
            required maxLength={128} value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Building A, Floor 2"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <button
        type="submit" disabled={loading}
        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
      >
        {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <PlusCircle size={16} />}
        {loading ? "Submitting..." : "Register Door"}
      </button>
      <StatusBadge status={status} />
    </form>
  );
}

function GrantAccessForm({ program }: { program: anchor.Program }) {
  const wallet = useAnchorWallet()!;
  const [doorId, setDoorId] = useState("");
  const [userKey, setUserKey] = useState("");
  const [commitment, setCommitment] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      if (commitment.length !== 64) throw new Error("Commitment must be 64 hex chars (32 bytes)");
      const id = parseInt(doorId);
      const userPubkey = new PublicKey(userKey);
      const commitmentArr = Array.from(Buffer.from(commitment, "hex"));
      const [doorPDA] = getDoorPDA(id);
      const [grantPDA] = getGrantPDA(userPubkey, id);
      const expiresAt = expiresInDays
        ? new anchor.BN(Math.floor(Date.now() / 1000) + parseInt(expiresInDays) * 86400)
        : null;

      const tx = await program.methods
        .grantAccess(new anchor.BN(id), commitmentArr, expiresAt)
        .accounts({
          accessGrant: grantPDA,
          user: userPubkey,
          doorAccount: doorPDA,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      setStatus({ ok: true, msg: `Access granted! Tx: ${tx}` });
      setDoorId(""); setUserKey(""); setCommitment(""); setExpiresInDays("");
    } catch (e: any) {
      setStatus({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Door ID</label>
          <input
            type="number" required value={doorId} onChange={(e) => setDoorId(e.target.value)}
            placeholder="e.g. 1"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Expires in days (leave blank = permanent)</label>
          <input
            type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)}
            placeholder="e.g. 90"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">User Public Key (base58)</label>
        <input
          required value={userKey} onChange={(e) => setUserKey(e.target.value)}
          placeholder="e.g. 8s6t3c..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Biometric Commitment (64 hex chars from mobile app)</label>
        <input
          required value={commitment} onChange={(e) => setCommitment(e.target.value)}
          placeholder="e.g. a3f1bc..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
        />
        <p className="text-xs text-slate-500 mt-1">SHA-256(biometric_key || "biometric-commitment") — provided by the user's mobile app during enrollment</p>
      </div>
      <button
        type="submit" disabled={loading}
        className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
      >
        {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <UserCheck size={16} />}
        {loading ? "Submitting..." : "Grant Access"}
      </button>
      <StatusBadge status={status} />
    </form>
  );
}

function RevokeAccessForm({ program }: { program: anchor.Program }) {
  const wallet = useAnchorWallet()!;
  const [doorId, setDoorId] = useState("");
  const [userKey, setUserKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const id = parseInt(doorId);
      const userPubkey = new PublicKey(userKey);
      const [doorPDA] = getDoorPDA(id);
      const [grantPDA] = getGrantPDA(userPubkey, id);

      const tx = await program.methods
        .revokeAccess()
        .accounts({
          accessGrant: grantPDA,
          doorAccount: doorPDA,
          authority: wallet.publicKey,
        })
        .rpc();
      setStatus({ ok: true, msg: `Access revoked! Tx: ${tx}` });
      setDoorId(""); setUserKey("");
    } catch (e: any) {
      setStatus({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Door ID</label>
          <input
            type="number" required value={doorId} onChange={(e) => setDoorId(e.target.value)}
            placeholder="e.g. 1"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">User Public Key (base58)</label>
          <input
            required value={userKey} onChange={(e) => setUserKey(e.target.value)}
            placeholder="e.g. 8s6t3c..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <button
        type="submit" disabled={loading}
        className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
      >
        {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <UserX size={16} />}
        {loading ? "Submitting..." : "Revoke Access"}
      </button>
      <StatusBadge status={status} />
    </form>
  );
}

export function AdminPage() {
  const { connected } = useWallet();
  const program = useAnchorProgram();
  const [tab, setTab] = useState<Tab>("register");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "register", label: "Register Door", icon: <DoorOpen size={16} /> },
    { id: "grant", label: "Grant Access", icon: <UserCheck size={16} /> },
    { id: "revoke", label: "Revoke Access", icon: <UserX size={16} /> },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <ShieldCheck className="text-indigo-400" size={32} />
          Admin Panel
        </h1>
        <p className="text-slate-400 mt-1">Manage doors and user access. Wallet must be the door authority.</p>
      </div>

      {!connected && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-12 text-center">
          <ShieldCheck size={48} className="mx-auto mb-4 text-slate-600" />
          <p className="text-slate-300 text-lg font-medium mb-2">Connect your wallet to continue</p>
          <p className="text-slate-500 text-sm mb-6">You need a Phantom or Solflare wallet to sign transactions.</p>
          <WalletMultiButton />
        </div>
      )}

      {connected && program && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex border-b border-slate-800">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "text-white border-b-2 border-indigo-500 bg-slate-800/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="p-6">
            {tab === "register" && <RegisterDoorForm program={program} />}
            {tab === "grant" && <GrantAccessForm program={program} />}
            {tab === "revoke" && <RevokeAccessForm program={program} />}
          </div>
        </div>
      )}
    </div>
  );
}
