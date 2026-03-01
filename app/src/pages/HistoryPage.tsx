import { useEffect, useState } from "react";
import { getReadonlyProgram } from "../program";
import type { AccessLog } from "../program";
import { History, CheckCircle, XCircle } from "lucide-react";

type LogRow = { publicKey: string; account: AccessLog };

export function HistoryPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDoor, setFilterDoor] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const program = getReadonlyProgram();
        const all = await (program.account as any).accessLog.all();
        const sorted = all.sort(
          (a: any, b: any) => b.account.timestamp.toNumber() - a.account.timestamp.toNumber()
        );
        setLogs(sorted.map((l: any) => ({ publicKey: l.publicKey.toBase58(), account: l.account })));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = filterDoor
    ? logs.filter((l) => l.account.doorId.toString() === filterDoor)
    : logs;

  const granted = filtered.filter((l) => l.account.granted).length;
  const denied = filtered.length - granted;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <History className="text-indigo-400" size={32} />
          Access History
        </h1>
        <p className="text-slate-400 mt-1">Immutable on-chain access log</p>
      </div>

      {!loading && !error && logs.length > 0 && (
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-white">{filtered.length}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
            <div className="bg-emerald-950 border border-emerald-900 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{granted}</p>
              <p className="text-xs text-emerald-600">Granted</p>
            </div>
            <div className="bg-red-950 border border-red-900 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-red-400">{denied}</p>
              <p className="text-xs text-red-600">Denied</p>
            </div>
          </div>
          <input
            type="number"
            placeholder="Filter by door ID..."
            value={filterDoor}
            onChange={(e) => setFilterDoor(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

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

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-24 text-slate-500">
          <History size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">No access logs found.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Door</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Slot</th>
                <th className="px-4 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr
                  key={l.publicKey}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors ${
                    i === filtered.length - 1 ? "border-0" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {new Date(l.account.timestamp.toNumber() * 1000).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded text-xs">
                      #{l.account.doorId.toString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400 text-xs">
                    {l.account.user.toBase58().slice(0, 16)}...
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                    {l.account.slot.toString()}
                  </td>
                  <td className="px-4 py-3">
                    {l.account.granted ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle size={14} /> Granted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400 font-medium">
                        <XCircle size={14} /> Denied
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
