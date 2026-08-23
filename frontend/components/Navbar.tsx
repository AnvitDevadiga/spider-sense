"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BellRing,
  Menu,
  X,
  Activity,
  CheckCircle2,
  Trash2,
  Radio,
  ShieldCheck,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Navbar() {
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [clearing, setClearing] = useState(false);

  // Check health beacon
  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => {
        if (r.ok) setBackendOnline(true);
        else setBackendOnline(false);
      })
      .catch(() => setBackendOnline(false));
  }, []);

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to reset and clear all scraper history?")) return;
    setClearing(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/clear-history`, { method: "POST" });
      const data = await res.json();
      setMessage(data.message || "🕸️ History cleared successfully!");
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setMessage("⚠️ Failed to clear history.");
      setClearing(false);
      setTimeout(() => setMessage(null), 3500);
    }
  };

  const navItems = [
    { label: "Sentinel Feed", href: "/alerts", icon: BellRing, badge: "LIVE" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-white/[0.08] transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-spidey-red to-spidey-darkred border border-white/20 flex items-center justify-center shadow-[0_0_20px_rgba(255,42,84,0.4)] group-hover:scale-105 transition-all duration-200">
              <span className="text-xl">🕷️</span>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-spidey-pop opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-spidey-pop"></span>
              </span>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white group-hover:text-spidey-red transition-colors">
                  SPIDER<span className="text-gradient-red">-SENSE</span>
                </span>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/[0.08] text-gray-300 border border-white/10 hidden sm:inline-block">
                  CYBER PRO
                </span>
              </div>
              <div className="flex items-center gap-1.5 -mt-0.5">
                <span className="text-[10px] font-mono text-gray-400 tracking-wider hidden sm:inline-flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5 text-spidey-cyan animate-pulse" />
                  Bright Data Scraper Telemetry
                </span>
                {backendOnline !== null && (
                  <span
                    className={`hidden sm:inline-block w-2 h-2 rounded-full ${
                      backendOnline
                        ? "bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse"
                        : "bg-yellow-400"
                    }`}
                    title={backendOnline ? "Scraper API Connected" : "Connecting..."}
                  />
                )}
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5 bg-white/[0.03] p-1.5 rounded-2xl border border-white/[0.08] backdrop-blur-xl">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-4 py-2 rounded-xl font-medium text-xs tracking-tight transition-all duration-200 flex items-center gap-2 ${
                    isActive
                      ? "text-white bg-spidey-red shadow-[0_0_20px_rgba(255,42,84,0.4)]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-gray-400"}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-spidey-pop text-black">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <div className="relative group hidden lg:block">
              <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-spidey-cyan/10 border border-spidey-cyan/30 text-spidey-cyan hover:bg-spidey-cyan/20 text-xs font-mono font-medium transition cursor-help">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>HEALER</span>
              </button>
              <div className="absolute right-0 top-full mt-2 w-80 p-4 rounded-xl bg-black border border-spidey-cyan/30 text-gray-300 text-xs leading-relaxed shadow-[0_0_30px_rgba(0,242,254,0.15)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <p className="italic font-serif">"You write a scraper, it works, and a week later the site changes its layout and everything breaks quietly. Build one that repairs itself instead, run it from your coding agent, and spend the week turning the data into something real."</p>
                <p className="mt-2 text-right text-[10px] text-spidey-cyan font-mono uppercase tracking-widest">- Project Rules</p>
              </div>
            </div>

            <button
              onClick={handleClearHistory}
              disabled={clearing}
              className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-gray-300 hover:text-white hover:border-red-400/50 hover:bg-red-500/10 text-xs font-mono font-medium transition cursor-pointer active:scale-95"
              title="Clear Scraper History & Reset Cache"
            >
              <Trash2 className={`w-3.5 h-3.5 text-red-400 ${clearing ? "animate-spin" : ""}`} />
              <span>{clearing ? "RESETTING..." : "RESET DATA"}</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-white/10 bg-black/95 backdrop-blur-3xl px-4 py-4 space-y-2 overflow-hidden"
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition ${
                    isActive
                      ? "bg-spidey-red text-white shadow-glow"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-spidey-pop text-black">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleClearHistory();
              }}
              disabled={clearing}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-mono text-xs text-gray-300 hover:bg-white/5 border border-white/10"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>Reset Scraper Cache</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-spidey-red text-white text-center py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,42,84,0.5)]"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-spidey-pop" />
            <span>{message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
