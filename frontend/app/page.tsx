"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProductImage from "@/components/ProductImage";
import PriceHistoryModal from "@/components/PriceHistoryModal";
import SkeletonLoader from "@/components/SkeletonLoader";
import { API, formatUsd, storeMeta, availabilityTone } from "@/lib/site";
import {
  Search,
  Zap,
  BellRing,
  ExternalLink,
  TrendingDown,
  AlertCircle,
  Radio,
  Sparkles,
  Loader2,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
} from "lucide-react";

interface StoreEntry {
  store: string;
  product_id: string;
  id?: string;
  title: string;
  price: number;
  image_url?: string | null;
  product_url?: string | null;
  availability?: string;
  rating?: number | null;
  review_count?: number | null;
}

interface StoreStatusState {
  status: "hunting" | "ready";
  product: StoreEntry | null;
}

interface ComparisonItem {
  item_name: string;
  category: string;
  stores: StoreEntry[];
  cheapest_store: string;
  cheapest_price: number;
  highest_price: number;
  max_savings_usd: number;
  max_savings_pct: number;
}

const RETAILERS = ["amazon", "bestbuy", "walmart"] as const;

const QUICK_SEARCH_CHIPS = [
  "Apple AirPods 4",
  "Sony WH-1000XM5",
  "Nintendo Switch OLED",
  "Bose QuietComfort 45",
  "SanDisk Extreme SSD",
];

// Framer Motion animation variants
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
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

const cardStaggerVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 15 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  // Per-store live status for the active search
  const [storeStatuses, setStoreStatuses] = useState<Record<string, StoreStatusState>>({
    amazon: { status: "hunting", product: null },
    bestbuy: { status: "hunting", product: null },
    walmart: { status: "hunting", product: null },
  });

  // Cached/All comparisons from backend
  const [comparisons, setComparisons] = useState<ComparisonItem[]>([]);
  const [actionStatus, setActionStatus] = useState<{
    msg: string;
    type: "success" | "info" | "error";
  } | null>(null);

  // Modal state
  const [modalProductId, setModalProductId] = useState<string | null>(null);

  // Polling ref to ensure single active interval
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial comparisons if any exist in DB
  const fetchComparisons = useCallback(async () => {
    try {
      const res = await fetch(`${API}/compare`);
      if (res.ok) {
        const data = await res.json();
        setComparisons(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error fetching comparisons:", e);
    }
  }, []);

  useEffect(() => {
    fetchComparisons();
  }, [fetchComparisons]);

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Poll status endpoint every 3s
  const pollStoreStatus = useCallback(
    async (term: string) => {
      try {
        const res = await fetch(
          `${API}/api/product/status?search_term=${encodeURIComponent(term)}`
        );
        if (!res.ok) return;

        const data = await res.json();
        setPollCount((prev) => prev + 1);

        if (data.stores) {
          setStoreStatuses((prev) => {
            const next = { ...prev };
            RETAILERS.forEach((store) => {
              if (data.stores[store]) {
                next[store] = data.stores[store];
              }
            });
            return next;
          });
        }

        // If all stores are completed or search complete, stop polling
        if (data.is_complete || (data.completed_stores && data.completed_stores.length === 3)) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          setSearching(false);
          setActionStatus({
            msg: "✨ Real-time telemetry secured: All retailer spider-bots synchronized!",
            type: "success",
          });
          fetchComparisons();
          setTimeout(() => setActionStatus(null), 5000);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    },
    [fetchComparisons]
  );

  const startSearch = async (termToSearch: string) => {
    const trimmed = termToSearch.trim();
    if (!trimmed) return;

    // Clear any existing polling timer
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    // 1. Immediately enter search mode & render 3 loading cards
    setActiveSearchTerm(trimmed);
    setSearchQuery(trimmed);
    setSearching(true);
    setPollCount(0);
    setStoreStatuses({
      amazon: { status: "hunting", product: null },
      bestbuy: { status: "hunting", product: null },
      walmart: { status: "hunting", product: null },
    });

    setActionStatus({
      msg: `🕷️ Spider-bots dispatched! Hunting for "${trimmed}" across Amazon, Best Buy, and Walmart...`,
      type: "info",
    });

    try {
      // 2. Dispatch POST /api/search (returns 200 on instant DB cache hit, 202 on async scraper dispatch)
      const res = await fetch(`${API}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const data = await res.json();
      if (res.ok && data.cached && data.stores) {
        // Immediate cache hit: Populate ready stores instantly without waiting
        setStoreStatuses((prev) => {
          const next = { ...prev };
          RETAILERS.forEach((store) => {
            if (data.stores[store]) {
              next[store] = data.stores[store];
            }
          });
          return next;
        });

        const allReady = RETAILERS.every((store) => data.stores[store]?.status === "ready");
        if (allReady) {
          setSearching(false);
          setActionStatus({
            msg: `⚡ Instant Intelligence: Retrieved live telemetry from database cache in 0.1s!`,
            type: "success",
          });
          fetchComparisons();
          setTimeout(() => setActionStatus(null), 4000);
          return;
        }
      } else if (res.ok || res.status === 202) {
        setActionStatus({
          msg: `📡 Real-time scraper pipeline live. Streaming DOM telemetry every 3s...`,
          type: "info",
        });
      } else {
        setActionStatus({
          msg: `⚠️ ${data.detail || "Search dispatch notice"}`,
          type: "error",
        });
      }
    } catch {
      setActionStatus({
        msg: "⚠️ Dispatching in background, awaiting live polling...",
        type: "info",
      });
    }

    // 3. Trigger initial poll immediately, then every 3 seconds
    pollStoreStatus(trimmed);
    const interval = setInterval(() => {
      pollStoreStatus(trimmed);
    }, 3000);
    pollTimerRef.current = interval;

    // Safety timeout: stop polling after 45 seconds
    setTimeout(() => {
      if (pollTimerRef.current === interval) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setSearching(false);
        fetchComparisons();
      }
    }, 45000);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startSearch(searchQuery);
  };

  const handleAddAlert = async (productId: string) => {
    try {
      const res = await fetch(`${API}/alerts/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus({ msg: `🔔 ${data.message || "Alert set!"}`, type: "success" });
      } else {
        setActionStatus({ msg: `⚠️ Failed to add alert.`, type: "error" });
      }
    } catch {
      setActionStatus({ msg: `⚠️ Network error adding alert.`, type: "error" });
    }
    setTimeout(() => setActionStatus(null), 4000);
  };

  // Derive active comparison stats from ready store products
  const readyStores = RETAILERS.map((k) => storeStatuses[k])
    .filter((s) => s.status === "ready" && s.product !== null)
    .map((s) => s.product as StoreEntry);

  const readyPrices = readyStores.map((s) => s.price).filter((p) => p > 0);
  const cheapestPrice = readyPrices.length ? Math.min(...readyPrices) : 0;
  const highestPrice = readyPrices.length ? Math.max(...readyPrices) : 0;
  const cheapestStoreKey = readyStores.find((s) => s.price === cheapestPrice)?.store || "amazon";
  const maxSavingsUsd = Math.max(0, highestPrice - cheapestPrice);
  const maxSavingsPct = highestPrice > 0 ? (maxSavingsUsd / highestPrice) * 100 : 0;

  const hasActiveSearch = !!activeSearchTerm;
  const hasHistory = comparisons.length > 0;
  const showHero = !hasActiveSearch && !hasHistory;

  return (
    <main className="min-h-screen bg-black/40 text-white relative pb-28 selection:bg-spidey-red selection:text-white overflow-hidden">
      {/* Dynamic Cyber Ambient Spotlights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-spidey-red/20 via-spidey-pop/5 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-spidey-cyan/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 blur-[130px] pointer-events-none" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-14 relative z-10"
      >
        {/* 1. CENTRALIZED SEARCH SECTION */}
        <motion.div
          layout
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className={`transition-all duration-500 ease-out ${
            showHero
              ? "flex flex-col items-center justify-center min-h-[62vh] text-center max-w-3xl mx-auto"
              : "mb-10 mt-1 max-w-4xl mx-auto"
          }`}
        >
          {showHero && (
            <motion.div variants={itemVariants} className="space-y-4 mb-8">
              {/* Telemetry pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-spidey-red/40 text-spidey-red text-xs font-mono font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(255,42,84,0.15)]">
                <Radio className="w-3.5 h-3.5 animate-pulse text-spidey-pop" />
                <span>Async Multi-Scraper Intelligence Engine</span>
              </div>

              <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
                Spider<span className="text-gradient-red">-Sense</span>
              </h1>
              
              <p className="max-w-2xl mx-auto text-gray-400 text-sm sm:text-lg font-normal leading-relaxed pt-1">
                Real-time predictive price arbitrage across Amazon, Best Buy & Walmart.<br />
                <span className="text-gradient-red font-semibold">
                  With Great Data Comes Great Savings.
                </span>
              </p>
            </motion.div>
          )}

          {/* Search Form with High-End Glassmorphism and Animated Glowing Button */}
          <motion.form
            layoutId="search-form-container"
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row items-center w-full gap-3 relative"
          >
            <div className="relative w-full group">
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-spidey-red transition-colors duration-200" />
              <input
                type="text"
                placeholder="Search product (e.g. Apple AirPods 4, Sony XM5, Switch OLED)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/60 border border-white/15 text-white text-base focus:outline-none focus:border-spidey-red focus:ring-2 focus:ring-spidey-red/30 transition-all placeholder-gray-500 shadow-2xl backdrop-blur-2xl"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              type="submit"
              disabled={searching}
              className="w-full sm:w-auto px-8 py-4 btn-cyber-glow text-white rounded-2xl font-mono font-bold text-sm shadow-[0_0_25px_rgba(255,42,84,0.4)] flex items-center justify-center gap-2.5 disabled:opacity-80 flex-shrink-0 cursor-pointer"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin text-spidey-pop" />
              ) : (
                <Zap className="w-4 h-4 text-spidey-pop fill-spidey-pop" />
              )}
              <span className="tracking-wide">
                {searching ? "SCANNING MATRIX..." : "TRACK PRICE"}
              </span>
            </motion.button>
          </motion.form>

          {/* Quick Search Chips with Glow Hover */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-2 mt-4"
          >
            <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-spidey-pop" /> Quick Hunt:
            </span>
            {QUICK_SEARCH_CHIPS.map((chip) => (
              <motion.button
                key={chip}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => startSearch(chip)}
                className="quick-chip px-3.5 py-1.5 rounded-xl text-xs font-mono text-gray-300 hover:text-white flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
              >
                <span>{chip}</span>
                <ArrowRight className="w-3 h-3 text-gray-500 group-hover:text-spidey-red transition-colors" />
              </motion.button>
            ))}
          </motion.div>

          {/* Status Message / Notification */}
          <AnimatePresence>
            {actionStatus && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className={`mt-6 px-5 py-3.5 rounded-2xl border text-xs sm:text-sm font-mono flex items-center gap-2.5 shadow-2xl backdrop-blur-xl ${
                  actionStatus.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.15)]"
                    : actionStatus.type === "error"
                    ? "bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_25px_rgba(239,68,68,0.15)]"
                    : "bg-spidey-cyan/10 text-spidey-cyan border-spidey-cyan/30 shadow-[0_0_25px_rgba(0,242,254,0.15)]"
                }`}
              >
                {actionStatus.type === "info" && <Radio className="w-4 h-4 animate-pulse flex-shrink-0" />}
                {actionStatus.type === "success" && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                {actionStatus.type === "error" && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{actionStatus.msg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 2. REAL-TIME ASYNC STREAMING VS TABLE (Active Search Mode) */}
        <AnimatePresence mode="wait">
          {hasActiveSearch && (
            <motion.div
              key="active-search-panel"
              layoutId="active-search-panel"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8 relative z-10 mb-16"
            >
              <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 bg-black/60 backdrop-blur-2xl">
                
                {/* VS Table Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/[0.08]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono uppercase tracking-widest text-spidey-cyan font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Live Multi-Store Matrix
                      </span>
                      {searching && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-spidey-pop/15 border border-spidey-pop/30 text-spidey-pop text-[10px] font-mono font-bold animate-pulse">
                          <Radio className="w-2.5 h-2.5 animate-spin" />
                          TELEMETRY POLLER #{pollCount} (3s)
                        </span>
                      )}
                    </div>
                    <h2 className="font-extrabold text-2xl sm:text-3xl text-white mt-1 capitalize tracking-tight">
                      {readyStores[0]?.title || activeSearchTerm}
                    </h2>
                  </div>

                  {/* Savings Badge if multiple stores loaded */}
                  {readyStores.length > 1 && maxSavingsUsd > 0 && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-emerald-950/60 border border-emerald-500/50 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.25)] backdrop-blur-xl"
                    >
                      <TrendingDown className="w-6 h-6 text-emerald-400 animate-bounce" />
                      <div>
                        <p className="text-[10px] text-emerald-400/80 font-mono uppercase font-bold tracking-widest">
                          Max Arbitrage Savings
                        </p>
                        <p className="font-mono text-lg sm:text-xl font-extrabold text-emerald-400">
                          ${maxSavingsUsd.toFixed(2)}{" "}
                          <span className="text-sm font-normal">({maxSavingsPct.toFixed(0)}% OFF)</span>
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Retailer Cards Grid (Amazon, Best Buy, Walmart) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {RETAILERS.map((storeKey, idx) => {
                    const storeState = storeStatuses[storeKey];
                    const storeData = storeState?.product;
                    const isReady = storeState?.status === "ready" && storeData !== null;
                    const sMeta = storeMeta(storeKey);
                    const isCheapest =
                      isReady &&
                      storeData?.store === cheapestStoreKey &&
                      readyStores.length > 1;

                    return (
                      <motion.div
                        key={storeKey}
                        custom={idx}
                        variants={cardStaggerVariants}
                        initial="hidden"
                        animate="visible"
                        className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-400 ${
                          isReady
                            ? isCheapest
                              ? "glass-card-emerald scale-[1.02]"
                              : "glass-card bg-[#0D1017]/80"
                            : "cyber-laser-scanner bg-black/60 border-white/[0.08]"
                        }`}
                      >
                        {/* Store Brand Badge & Live Status Pill */}
                        <div className="flex items-center justify-between mb-5">
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase border backdrop-blur-md ${sMeta.badge}`}
                          >
                            {sMeta.label}
                          </span>

                          {isReady ? (
                            isCheapest ? (
                              <span className="px-2.5 py-1 bg-emerald-500 text-black text-[10px] font-mono font-extrabold rounded-md shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse">
                                BEST PRICE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
                                <CheckCircle2 className="w-3 h-3" />
                                READY
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-spidey-pop/10 border border-spidey-pop/30 text-spidey-pop text-[10px] font-mono font-bold animate-pulse">
                              <Radio className="w-3 h-3 animate-spin" />
                              Spider-bot hunting...
                            </span>
                          )}
                        </div>

                        {/* Content: Ready Product OR Live Cyber Laser Skeleton Loader */}
                        {isReady && storeData ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.35 }}
                            className="flex flex-col flex-1"
                          >
                            {/* Image & Price */}
                            <div className="flex flex-col items-center text-center mb-6">
                              <div className="w-28 h-28 rounded-2xl overflow-hidden bg-black/70 border border-white/10 mb-4 p-2.5 flex items-center justify-center shadow-inner group">
                                <ProductImage
                                  src={storeData.image_url}
                                  alt={storeData.title}
                                  source={storeData.store}
                                  category="Electronics"
                                  fallbackSize="md"
                                />
                              </div>
                              <h3 className="text-sm font-semibold text-gray-200 line-clamp-2 leading-snug mb-3 min-h-[40px] tracking-tight">
                                {storeData.title}
                              </h3>
                              <div className="font-mono text-3xl sm:text-4xl font-extrabold text-spidey-pop tracking-tight">
                                {formatUsd(storeData.price)}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider font-semibold border ${availabilityTone(storeData.availability)}`}>
                                  {storeData.availability || "In Stock"}
                                </span>
                                {storeData.rating && (
                                  <span className="text-[10px] font-mono text-gray-400">
                                    ★ {storeData.rating} ({storeData.review_count || 0})
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-auto space-y-2.5 pt-4 border-t border-white/[0.06]">
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleAddAlert(storeData.product_id || storeData.id || "")}
                                className="w-full py-2.5 px-4 bg-spidey-cyan/10 text-spidey-cyan hover:bg-spidey-cyan/20 border border-spidey-cyan/30 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <BellRing className="w-3.5 h-3.5" />
                                ADD DROP ALERT
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() =>
                                  setModalProductId(storeData.product_id || storeData.id || "")
                                }
                                className="w-full py-2.5 px-4 bg-white/5 text-white hover:bg-white/10 border border-white/10 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <TrendingDown className="w-3.5 h-3.5 text-spidey-pop" />
                                PRICE INTELLIGENCE
                              </motion.button>
                              <a
                                href={storeData.product_url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2.5 px-4 text-gray-400 hover:text-white rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2"
                              >
                                VIEW AT {sMeta.label.toUpperCase()}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </motion.div>
                        ) : (
                          <SkeletonLoader />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. HISTORICAL / SEEDED COMPARISONS FEED */}
        {hasHistory && !hasActiveSearch && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-10"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-spidey-pop" />
                  Tracked Product Comparisons
                </h3>
                <p className="text-xs text-gray-400 font-mono">
                  Real-time intelligence from Bright Data Scraper Studio
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-white/[0.05] border border-white/10 text-xs font-mono text-gray-300">
                {comparisons.length} Tracked
              </span>
            </div>

            {comparisons.map((item, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="glass-card rounded-3xl p-6 sm:p-8 bg-black/60 backdrop-blur-2xl"
              >
                {/* VS Table Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/[0.08]">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-widest text-spidey-cyan font-bold">
                      Tracked Matrix
                    </span>
                    <h4 className="font-extrabold text-2xl sm:text-3xl text-white mt-1 tracking-tight">
                      {item.item_name}
                    </h4>
                  </div>
                  {item.stores.length > 1 && item.max_savings_usd > 0 && (
                    <div className="bg-emerald-950/60 border border-emerald-500/40 px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                      <TrendingDown className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="text-[10px] text-emerald-400/80 font-mono uppercase font-bold tracking-widest">
                          Max Savings
                        </p>
                        <p className="font-mono text-base font-bold text-emerald-400">
                          ${item.max_savings_usd.toFixed(2)} ({item.max_savings_pct.toFixed(0)}%)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Retailer Columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {RETAILERS.map((storeKey) => {
                    const storeData = item.stores.find((s) => s.store === storeKey);
                    const sMeta = storeMeta(storeKey);
                    const isCheapest =
                      storeData &&
                      storeData.store === item.cheapest_store &&
                      item.stores.length > 1;

                    return (
                      <div
                        key={storeKey}
                        className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 ${
                          storeData
                            ? isCheapest
                              ? "glass-card-emerald scale-[1.02]"
                              : "glass-card bg-[#0D1017]/80 hover:border-white/20"
                            : "bg-black/40 border-white/5 opacity-50 grayscale"
                        }`}
                      >
                        {/* Retailer Brand Badge */}
                        <div className="flex items-center justify-between mb-6">
                          <span
                            className={`px-3 py-1 rounded text-xs font-mono font-bold uppercase border ${sMeta.badge}`}
                          >
                            {sMeta.label}
                          </span>
                          {isCheapest && (
                            <span className="px-2 py-1 bg-emerald-500 text-black text-[10px] font-mono font-bold rounded shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                              BEST PRICE
                            </span>
                          )}
                        </div>

                        {storeData ? (
                          <>
                            {/* Image & Price */}
                            <div className="flex flex-col items-center text-center mb-6">
                              <div className="w-24 h-24 rounded-xl overflow-hidden bg-black/60 border border-white/10 mb-4 p-2 flex items-center justify-center shadow-inner">
                                <ProductImage
                                  src={storeData.image_url}
                                  alt={storeData.title}
                                  source={storeData.store}
                                  category={item.category}
                                  fallbackSize="md"
                                />
                              </div>
                              <h5 className="text-[13px] text-gray-300 line-clamp-2 leading-relaxed mb-3 min-h-[40px] tracking-tight">
                                {storeData.title}
                              </h5>
                              <div className="font-mono text-3xl font-extrabold text-spidey-pop">
                                {formatUsd(storeData.price)}
                              </div>
                              <span className="text-[10px] font-mono text-gray-500 mt-1 uppercase tracking-widest">
                                {storeData.availability || "In Stock"}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-auto space-y-2.5">
                              <button
                                onClick={() => handleAddAlert(storeData.product_id)}
                                className="w-full py-2.5 px-4 bg-spidey-cyan/10 text-spidey-cyan hover:bg-spidey-cyan/20 border border-spidey-cyan/30 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                              >
                                <BellRing className="w-3.5 h-3.5" />
                                ADD ALERT
                              </button>
                              <button
                                onClick={() => setModalProductId(storeData.product_id)}
                                className="w-full py-2.5 px-4 bg-white/5 text-white hover:bg-white/10 border border-white/10 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                              >
                                <TrendingDown className="w-3.5 h-3.5 text-spidey-pop" />
                                PRICE HISTORY
                              </button>
                              <a
                                href={storeData.product_url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2.5 px-4 text-gray-400 hover:text-white rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2"
                              >
                                VIEW AT STORE
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-center py-10">
                            <AlertCircle className="w-8 h-8 text-gray-600 mb-3" />
                            <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">
                              No matching
                              <br />
                              product found
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Price History Modal Overlay */}
      <PriceHistoryModal
        productId={modalProductId}
        isOpen={!!modalProductId}
        onClose={() => setModalProductId(null)}
      />
    </main>
  );
}
