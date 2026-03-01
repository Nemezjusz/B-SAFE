import { useEffect, useState } from "react";
import { getReadonlyProgram } from "../program";
import type { DoorAccount } from "../program";
import { DoorOpen, MapPin, CheckCircle, XCircle, Activity } from "lucide-react";

type DoorRow = { publicKey: string; account: DoorAccount };

export function DoorsPage() {
  const [doors, setDoors] = useState<DoorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const program = getReadonlyProgram();
        const all = await (program.account as any).doorAccount.all();
        const sorted = all.sort(
          (a: any, b: any) => a.account.doorId.toNumber() - b.account.doorId.toNumber()
        );
        setDoors(sorted.map((d: any) => ({ publicKey: d.publicKey.toBase58(), account: d.account })));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <DoorOpen className="text-indigo-400" size={32} />
          Access Doors
        </h1>
        <p className="text-slate-400 mt-1">All registered doors on-chain</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-3" />
          Loading from blockchain...
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && doors.length === 0 && (
        <div className="text-center py-24 text-slate-500">
          <DoorOpen size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">No doors registered yet.</p>
          <p className="text-sm mt-1">Use the Admin panel to register the first door.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {doors.map((d) => (
          <div
            key={d.publicKey}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded-md">
                  #{d.account.doorId.toString()}
                </span>
                <h2 className="text-lg font-semibold text-white mt-2">{d.account.name}</h2>
              </div>
              {d.account.isActive ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950 px-2 py-1 rounded-full">
                  <CheckCircle size={12} /> Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-400 bg-red-950 px-2 py-1 rounded-full">
                  <XCircle size={12} /> Inactive
                </span>
              )}
            </div>

            <div className="space-y-2 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-slate-500" />
                {d.account.location}
              </div>
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-slate-500" />
                {d.account.totalAccesses.toString()} total accesses
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-xs font-mono text-slate-600 truncate" title={d.publicKey}>
                {d.publicKey.slice(0, 20)}...
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
