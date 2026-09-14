"use client";
import Link from "next/link";
import {
  Activity,
  Terminal,
  Cpu,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function Footer() {
  const stores = [
    { name: "Amazon", color: "text-amber-400 border-amber-500/20 bg-amber-500/10", dot: "bg-amber-400" },
    { name: "Walmart", color: "text-blue-400 border-blue-500/20 bg-blue-500/10", dot: "bg-blue-400" },
    { name: "Best Buy", color: "text-yellow-400 border-yellow-500/20 bg-yellow-500/10", dot: "bg-yellow-400" },
  ];

  return (
    <footer className="bg-[#060709] border-t border-white/[0.08] text-gray-400 py-12 mt-20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10">
          {/* Brand Col */}
          <div className="md:col-span-5 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-spidey-red to-spidey-darkred border border-white/20 flex items-center justify-center text-sm shadow-glow">
                🕷️
              </div>
              <span className="font-bold text-lg tracking-tight text-white">
                SPIDER<span className="text-spidey-red">-SENSE</span>
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed max-w-md">
              Real-time predictive e-commerce price intelligence engine watching Amazon, Walmart, and
              Best Buy. Built for the Bright Data &apos;Into the Scrape-Verse&apos; Hackathon.
            </p>

            {/* Architecture pill tags */}
            <div className="flex flex-wrap gap-1.5 pt-1 font-mono text-[10px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-spidey-pop">
                <Zap className="w-2.5 h-2.5 text-spidey-pop" /> Bright Data Scraper Studio
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-spidey-cyan">
                <Terminal className="w-2.5 h-2.5 text-spidey-cyan" /> FastAPI
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-white">
                <Layers className="w-2.5 h-2.5 text-white" /> Next.js 14
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-spidey-red">
                <Cpu className="w-2.5 h-2.5 text-spidey-red" /> scikit-learn
              </span>
            </div>
          </div>

          {/* Quick Nav */}
          <div className="md:col-span-3 space-y-2.5">
            <h4 className="font-mono text-xs uppercase tracking-wider text-gray-300 font-semibold">
              Platform Features
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/"
                  className="flex items-center justify-between text-gray-400 hover:text-white transition group"
                >
                  <span>Intelligence Command Center</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-spidey-red" />
                </Link>
              </li>
              <li>
                <Link
                  href="/#results"
                  className="flex items-center justify-between text-gray-400 hover:text-white transition group"
                >
                  <span>Multi-Store Price Matrix</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-spidey-red" />
                </Link>
              </li>
              <li>
                <Link
                  href="/alerts"
                  className="flex items-center justify-between text-gray-400 hover:text-white transition group"
                >
                  <span>Price Drop Sentinel Feed</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-spidey-red" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Monitored Retailers */}
          <div className="md:col-span-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-xs uppercase tracking-wider text-gray-300 font-semibold">
                Live Retailer Collectors
              </h4>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                3 Online
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {stores.map((store) => (
                <div
                  key={store.name}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border font-mono text-xs font-medium ${store.color}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${store.dot}`} />
                  <span>{store.name}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] font-mono text-[11px] text-gray-400">
                <ShieldCheck className="w-3 h-3 text-spidey-cyan" />
                <span>Web Unlocker Proxy</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2 text-[11px]">
            <span>Bright Data &apos;Into the Scrape-Verse&apos; Hackathon Submission</span>
            <span className="text-gray-700">|</span>
            <span>AI-Assisted Pair Programming Fully Disclosed</span>
          </div>

          <div className="mt-3 sm:mt-0 font-mono text-[11px] flex items-center gap-2">
            <span className="text-gray-400">Pipeline Status:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <Activity className="w-3 h-3 animate-pulse" /> Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
