"use client";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SpiderAlert from "@/components/SpiderAlert";
import { Skeleton } from "@/components/Skeleton";
import { API, fetchJson } from "@/lib/site";
import {
  BellRing,
  Zap,
  Flame,
  Package,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Send,
} from "lucide-react";

interface AlertItem {
  id: number;
  product_id: string;
  alert_type: string;
  message: string;
  old_price: number;
  new_price: number;
  drop_percent: number;
  product_title?: string | null;
  product_image?: string | null;
  product_source?: string | null;
  created_at: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    const url = new URL(`${API}/alerts`);
    if (filter) url.searchParams.append("alert_type", filter);
    const data = await fetchJson<AlertItem[]>(url.toString());
    setAlerts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchAlerts();
  }, [fetchAlerts]);

  const handleSimulateDrop = async () => {
    setSimulating(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/demo/simulate-drop`, { method: "POST" });
      const data = await res.json();
      setMessage(data.alert_triggered || "🕷️ Simulated flash sale price drop recorded!");
      await fetchAlerts();
      setTimeout(() => setMessage(null), 5000);
    } catch {
      setMessage("⚠️ Simulation failed. Ensure backend API is active.");
      setTimeout(() => setMessage(null), 3500);
    } finally {
      setSimulating(false);
    }
  };

  const tabs = [
    { key: "", label: "All Alerts", icon: BellRing },
    { key: "lowest_ever", label: "All-Time Lows", icon: Sparkles },
    { key: "price_drop", label: "Flash Sales (10%+ Off)", icon: Flame },
    { key: "back_in_stock", label: "Back in Stock", icon: Package },
  ];

  return (
    <main className="min-h-screen bg-black/40 text-white p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-28 relative">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[300px] bg-spidey-red/10 blur-[130px] pointer-events-none" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-spidey-red/15 border border-spidey-red/40 flex items-center justify-center text-spidey-red shadow-[0_0_20px_rgba(255,42,84,0.3)]">
              <BellRing className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Price Drop <span className="text-gradient-red">Sentinel Feed</span>
            </h1>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm mt-1 max-w-2xl font-normal leading-relaxed">
            Real-time feed triggering instant arbitrage warnings when prices hit 30-day all-time lows or flash discount spikes across Amazon, Walmart, and Best Buy.
          </p>
        </div>

        {/* Live Simulation Button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleSimulateDrop}
          disabled={simulating}
          className="px-5 py-3 btn-cyber-glow text-white rounded-2xl text-xs font-mono font-bold tracking-wider shadow-[0_0_25px_rgba(255,42,84,0.35)] transition-all flex items-center gap-2 self-start md:self-auto disabled:opacity-50 cursor-pointer"
        >
          <Zap className={`w-3.5 h-3.5 ${simulating ? "animate-spin" : "fill-white"}`} />
          <span>{simulating ? "TRIGGERING DROP..." : "SIMULATE FLASH DROP"}</span>
        </motion.button>
      </motion.div>

      {/* Email Subscription Glass Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-8 glass-card p-6 sm:p-7 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-spidey-cyan/30 bg-black/60 shadow-[0_0_30px_rgba(0,242,254,0.1)]"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-spidey-cyan font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Instant Dispatch
            </span>
          </div>
          <h3 className="font-extrabold text-lg text-white mt-1 tracking-tight">
            Subscribe to Real-Time Price Drops
          </h3>
          <p className="text-gray-400 text-xs font-mono mt-0.5">
            Receive automated sentinel pings the millisecond prices hit all-time records.
          </p>
        </div>
        <form
          className="flex items-center gap-2 w-full sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            setMessage(`✉️ Sentinel alert subscribed for ${(form.elements.namedItem('email') as HTMLInputElement).value}!`);
            form.reset();
            setTimeout(() => setMessage(null), 4000);
          }}
        >
          <input
            type="email"
            name="email"
            placeholder="Enter operator email..."
            required
            className="w-full sm:w-64 px-4 py-2.5 rounded-xl bg-black/70 border border-white/15 text-white text-sm focus:border-spidey-cyan focus:outline-none transition placeholder-gray-500 font-mono"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-spidey-cyan hover:bg-cyan-300 text-black font-extrabold rounded-xl text-xs font-mono transition flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,242,254,0.4)] cursor-pointer active:scale-95"
          >
            <span>SUBSCRIBE</span>
            <Send className="w-3 h-3" />
          </button>
        </form>
      </motion.div>

      {/* Toast Feedback */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 bg-black/90 text-white py-3 px-5 rounded-2xl text-xs font-mono font-medium shadow-2xl border border-spidey-red/50 flex items-center gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-spidey-pop flex-shrink-0" />
            <span>{message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-white/[0.08] pb-4">
        {tabs.map((tab) => {
          const isActive = filter === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-2 border cursor-pointer ${
                isActive
                  ? "bg-spidey-red text-white border-red-400 shadow-[0_0_20px_rgba(255,42,84,0.4)]"
                  : "bg-white/[0.03] text-gray-400 border-white/5 hover:text-white hover:border-white/20"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-gray-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Alerts Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="cyber-laser-scanner glass-card rounded-2xl p-5 space-y-3 bg-black/60">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-6 w-1/2" />
            </div>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-24 glass-card rounded-3xl p-8 max-w-md mx-auto bg-black/60 border border-white/10">
          <span className="text-5xl mb-4 block animate-bounce">🕸️</span>
          <h3 className="font-extrabold text-xl text-white tracking-tight">No Active Sentinel Alerts</h3>
          <p className="text-gray-400 text-xs mt-2 leading-relaxed font-mono">
            Click &quot;Simulate Flash Drop&quot; to test real-time arbitrage evaluation.
          </p>
          <button
            onClick={handleSimulateDrop}
            className="mt-5 px-5 py-2.5 btn-cyber-glow text-white rounded-xl text-xs font-mono font-bold shadow-[0_0_20px_rgba(255,42,84,0.4)] transition cursor-pointer"
          >
            ⚡ SIMULATE LIVE ALERT
          </button>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {alerts.map((a) => (
            <motion.div key={a.id} variants={itemVariants}>
              <SpiderAlert
                productId={a.product_id}
                alertType={a.alert_type}
                message={a.message}
                oldPrice={a.old_price}
                newPrice={a.new_price}
                dropPercent={a.drop_percent}
                productTitle={a.product_title}
                productImage={a.product_image}
                productSource={a.product_source}
                createdAt={a.created_at}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </main>
  );
}
