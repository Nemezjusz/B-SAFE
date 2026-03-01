import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { SolanaWalletProvider } from "./WalletProvider";
import { DoorsPage } from "./pages/DoorsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { AdminPage } from "./pages/AdminPage";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { DoorOpen, History, ShieldCheck } from "lucide-react";

function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-600 text-white"
        : "text-slate-400 hover:text-white hover:bg-slate-800"
    }`;

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-indigo-400" size={22} />
          <span className="font-bold text-white text-lg">B-SAFE</span>
        </div>
        <div className="flex items-center gap-1">
          <NavLink to="/" className={linkClass} end>
            <DoorOpen size={16} /> Doors
          </NavLink>
          <NavLink to="/history" className={linkClass}>
            <History size={16} /> History
          </NavLink>
          <NavLink to="/admin" className={linkClass}>
            <ShieldCheck size={16} /> Admin
          </NavLink>
        </div>
        <WalletMultiButton style={{ fontSize: "13px", height: "36px", borderRadius: "8px" }} />
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <SolanaWalletProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950">
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<DoorsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </SolanaWalletProvider>
  );
}
