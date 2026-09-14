"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Check, ChevronRight, Clock3,
  ExternalLink, Loader2, Radar, Search, ShieldCheck, Wifi, X, Zap, TrendingDown,
} from "lucide-react";
import PriceHistoryModal from "@/components/PriceHistoryModal";
import ProductImage from "@/components/ProductImage";
import { API, formatUsd, storeMeta } from "@/lib/site";

type Retailer = "amazon" | "bestbuy" | "walmart";

interface StoreEntry {
  store: Retailer;
  product_id: string;
  title: string;
  price: number;
  image_url?: string | null;
  product_url?: string | null;
  availability?: string;
  rating?: number | null;
  review_count?: number | null;
  scraped_at?: string | null;
}

interface StoreState { status: "hunting" | "ready"; product: StoreEntry | null; }

interface Comparison {
  item_name: string;
  category: string;
  stores: StoreEntry[];
  cheapest_store: Retailer;
  cheapest_price: number;
  highest_price: number;
  max_savings_usd: number;
  max_savings_pct: number;
}

interface Stats {
  products_tracked: number;
  price_points: number;
  alerts_triggered?: number;
  alerts_active?: number;
}

const RETAILERS: Retailer[] = ["amazon", "bestbuy", "walmart"];
const QUICK_SEARCHES = ["Apple AirPods 4", "Sony WH-1000XM5", "Nintendo Switch OLED"];
const emptyStores = (): Record<Retailer, StoreState> => ({
  amazon: { status: "hunting", product: null },
  bestbuy: { status: "hunting", product: null },
  walmart: { status: "hunting", product: null },
});

const reveal = {
  hidden: { opacity: 0, y: 22 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: index * 0.07, duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  }),
};

function StoreMark({ store }: { store: Retailer }) {
  const letters = { amazon: "A", bestbuy: "B", walmart: "W" };
  return <span className={`store-mark store-mark-${store}`}>{letters[store]}</span>;
}

function WebSignal({ active }: { active: boolean }) {
  return (
    <div className={`sense-orb ${active ? "is-scanning" : ""}`} aria-hidden="true">
      <div className="sense-ring sense-ring-one" />
      <div className="sense-ring sense-ring-two" />
      <div className="sense-ring sense-ring-three" />
      <div className="sense-core">
        <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none">
          <path d="M32 8v48M8 32h48M15 15l34 34M49 15 15 49" stroke="currentColor" strokeWidth="2" />
          <circle cx="32" cy="32" r="17" stroke="currentColor" strokeWidth="2" />
          <circle cx="32" cy="32" r="6" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [stores, setStores] = useState<Record<Retailer, StoreState>>(emptyStores);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searching, setSearching] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [notice, setNotice] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null);
  const [modalProductId, setModalProductId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timerRef.current = null;
    timeoutRef.current = null;
  }, []);

  const loadDashboard = useCallback(async () => {
    const [comparisonResult, statsResult] = await Promise.allSettled([
      fetch(`${API}/api/compare`).then((response) => (response.ok ? response.json() : [])),
      fetch(`${API}/stats`).then((response) => (response.ok ? response.json() : null)),
    ]);
    if (comparisonResult.status === "fulfilled") {
      setComparisons(Array.isArray(comparisonResult.value) ? comparisonResult.value : []);
    }
    if (statsResult.status === "fulfilled") setStats(statsResult.value);
  }, []);

  useEffect(() => {
    loadDashboard();
    return stopPolling;
  }, [loadDashboard, stopPolling]);

  const applyStores = useCallback((incoming?: Partial<Record<Retailer, StoreState>>) => {
    if (!incoming) return;
    setStores((current) => {
      const next = { ...current };
      RETAILERS.forEach((retailer) => {
        if (incoming[retailer]) next[retailer] = incoming[retailer] as StoreState;
      });
      return next;
    });
  }, []);

  const poll = useCallback(async (term: string) => {
    try {
      const response = await fetch(`${API}/api/product/status?search_term=${encodeURIComponent(term)}`);
      if (!response.ok) return;
      const data = await response.json();
      setPulse((value) => value + 1);
      applyStores(data.stores);
      if (data.is_complete) {
        stopPolling();
        setSearching(false);
        setNotice({ tone: "good", text: "All three storefronts are locked. Best price identified." });
        loadDashboard();
      }
    } catch {
      setNotice({ tone: "bad", text: "The signal was interrupted. Reconnecting to the API…" });
    }
  }, [applyStores, loadDashboard, stopPolling]);

  const runSearch = useCallback(async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term || searching) return;
    stopPolling();
    setActiveQuery(term);
    setQuery(term);
    setStores(emptyStores());
    setSearching(true);
    setPulse(0);
    setNotice({ tone: "info", text: "Casting a search web across Amazon, Best Buy, and Walmart." });

    try {
      const response = await fetch(`${API}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: term }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Search could not start");
      applyStores(data.stores);
      if (data.cached && data.stores) {
        setSearching(false);
        setNotice({ tone: "good", text: "Fresh prices recovered instantly from the signal cache." });
        loadDashboard();
        return;
      }
    } catch (error) {
      stopPolling();
      setSearching(false);
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "The search could not start." });
      return;
    }

    await poll(term);
    timerRef.current = setInterval(() => poll(term), 2500);
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setSearching(false);
      setNotice({ tone: "info", text: "The scan paused after two minutes. Any prices found are still shown below." });
      loadDashboard();
    }, 120000);
  }, [applyStores, loadDashboard, poll, searching, stopPolling]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    runSearch(query);
  };

  const addAlert = async (productId: string) => {
    try {
      const response = await fetch(`${API}/api/alerts/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not create alert");
      setNotice({ tone: "good", text: data.message || "Price-drop watch activated." });
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Could not create alert." });
    }
  };

  const readyProducts = useMemo(
    () => RETAILERS.map((retailer) => stores[retailer].product).filter(Boolean) as StoreEntry[],
    [stores]
  );
  const readyPrices = readyProducts.map((product) => product.price).filter((price) => price > 0);
  const cheapest = readyPrices.length ? Math.min(...readyPrices) : 0;
  const highest = readyPrices.length ? Math.max(...readyPrices) : 0;
  const savings = highest - cheapest;
  const savingsPercent = highest > 0 ? (savings / highest) * 100 : 0;
  const hasSearch = Boolean(activeQuery);

  return (
    <main className="min-h-screen overflow-hidden">
      <section className="relative mx-auto max-w-[1440px] px-4 pb-14 pt-8 sm:px-6 lg:px-10 lg:pt-12">
        <div className="web-corner web-corner-left" aria-hidden="true" />
        <div className="web-corner web-corner-right" aria-hidden="true" />
        <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_.92fr] lg:gap-8">
          <motion.div initial="hidden" animate="visible" variants={reveal} className="relative z-10">
            <div className="signal-label mb-5"><span className="signal-dot" /> Live price intelligence <span className="text-white/30">/</span> Bright Data network</div>
            <h1 className="max-w-4xl font-display text-[clamp(3.6rem,8vw,7.8rem)] font-black uppercase leading-[.78] tracking-[-0.075em] text-white">
              Catch the
              <span className="relative block text-signal-red">
                price drop
                <svg className="headline-strike" viewBox="0 0 520 32" preserveAspectRatio="none" aria-hidden="true">
                  <motion.path d="M4 24C126 2 331 3 516 16" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.55, duration: 0.8, ease: "easeOut" }} />
                </svg>
              </span>
              <span className="block text-outline">before it moves.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              One search sends three spiders across the biggest storefronts, compares the live catch, and tells you where your money goes furthest.
            </p>

            <form onSubmit={submitSearch} className="search-rig mt-8" aria-label="Search store prices">
              <Search className="h-5 w-5 shrink-0 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a product or paste a store URL" aria-label="Product or store URL" />
              {query && !searching && <button type="button" onClick={() => setQuery("")} className="clear-search" aria-label="Clear search"><X className="h-4 w-4" /></button>}
              <motion.button type="submit" disabled={!query.trim() || searching} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="search-button">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}{searching ? "Scanning" : "Scan prices"}
              </motion.button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs uppercase tracking-[.18em] text-slate-500">Quick cast</span>
              {QUICK_SEARCHES.map((term) => <button key={term} onClick={() => runSearch(term)} disabled={searching} className="quick-cast">{term}<ChevronRight className="h-3 w-3" /></button>)}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.86, rotate: 4 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.18, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="relative flex min-h-[390px] items-center justify-center lg:min-h-[530px]">
            <div className="radar-copy radar-copy-top"><Wifi className="h-3 w-3" /> Network awake</div>
            <div className="radar-copy radar-copy-bottom">3 storefronts / 1 signal</div>
            <WebSignal active={searching} />
            <div className="orbit orbit-amazon"><StoreMark store="amazon" /></div>
            <div className="orbit orbit-bestbuy"><StoreMark store="bestbuy" /></div>
            <div className="orbit orbit-walmart"><StoreMark store="walmart" /></div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-4">
          {[[stats?.products_tracked ?? "—", "Products tracked"], [stats?.price_points ?? "—", "Price signals"], [stats?.alerts_triggered ?? stats?.alerts_active ?? "—", "Drops caught"], ["3 / 3", "Collectors online"]].map(([value, label]) => (
            <div key={label} className="metric-cell"><strong>{value}</strong><span>{label}</span></div>
          ))}
        </motion.div>
      </section>

      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={`notice-bar notice-${notice.tone}`}>
            {notice.tone === "good" ? <Check className="h-4 w-4" /> : notice.tone === "bad" ? <X className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
            <span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss message"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {hasSearch && (
        <section className="results-section" id="results">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10">
            <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <div className="signal-label mb-3"><span className={searching ? "signal-dot" : "signal-dot signal-dot-still"} />{searching ? `Signal pulse ${pulse + 1}` : `${readyProducts.length} storefronts locked`}</div>
                <h2 className="font-display text-4xl font-black uppercase tracking-[-.04em] text-white sm:text-5xl">{readyProducts[0]?.title || activeQuery}</h2>
              </div>
              {readyProducts.length > 1 && <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="savings-ticket"><TrendingDown className="h-6 w-6" /><span>Spread caught<strong>{formatUsd(savings)} · {savingsPercent.toFixed(0)}%</strong></span></motion.div>}
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {RETAILERS.map((retailer, index) => {
                const product = stores[retailer].product;
                const isBest = Boolean(product && product.price === cheapest && readyProducts.length > 1);
                const meta = storeMeta(retailer);
                return (
                  <motion.article key={retailer} custom={index} initial="hidden" animate="visible" variants={reveal} layout className={`store-card ${isBest ? "store-card-best" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3"><StoreMark store={retailer} /><span className="font-bold text-white">{meta.label}</span></div>
                      {product ? <span className={isBest ? "best-tag" : "ready-tag"}>{isBest ? "Best catch" : "Locked"}</span> : <span className="hunting-tag"><Loader2 className="h-3 w-3 animate-spin" /> Hunting</span>}
                    </div>

                    {product ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-7 flex h-full flex-col">
                        <div className="product-frame"><ProductImage src={product.image_url} alt={product.title} source={retailer} category="Electronics" /></div>
                        <p className="mt-5 line-clamp-2 min-h-12 text-base font-semibold leading-6 text-slate-200">{product.title}</p>
                        <div className="mt-5 flex items-end justify-between gap-4"><div><span className="eyebrow">Current price</span><strong className="price-value">{formatUsd(product.price)}</strong></div>{product.rating ? <span className="rating-pill">★ {product.rating}</span> : null}</div>
                        <div className="mt-6 grid grid-cols-2 gap-2">
                          <button onClick={() => addAlert(product.product_id)} className="secondary-action"><Bell className="h-4 w-4" /> Watch drop</button>
                          <button onClick={() => setModalProductId(product.product_id)} className="secondary-action"><Activity className="h-4 w-4" /> Forecast</button>
                        </div>
                        {product.product_url && <a href={product.product_url} target="_blank" rel="noreferrer" className="store-link">Open at {meta.label}<ExternalLink className="h-3.5 w-3.5" /></a>}
                      </motion.div>
                    ) : (
                      <div className="hunting-panel"><div className="scan-line" /><Radar className="h-8 w-8 text-signal-red" /><strong>Threading through live listings</strong><span>Waiting for {meta.label} to return a verified price.</span></div>
                    )}
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {!hasSearch && comparisons.length > 0 && (
        <section className="results-section">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10">
            <div className="mb-8 flex items-end justify-between gap-4"><div><span className="eyebrow">From the archive</span><h2 className="section-title">Recent catches</h2></div><span className="archive-count">{comparisons.length} signals</span></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {comparisons.slice(0, 6).map((item, index) => (
                <motion.article key={`${item.item_name}-${index}`} custom={index} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={reveal} className="archive-card">
                  <div className="flex items-center justify-between gap-4"><div className="flex -space-x-2">{item.stores.slice(0, 3).map((store) => <StoreMark key={store.product_id} store={store.store} />)}</div><span className="text-xs uppercase tracking-[.16em] text-slate-500">{item.stores.length} stores</span></div>
                  <h3>{item.item_name}</h3>
                  <div className="mt-6 flex items-end justify-between border-t border-white/10 pt-5"><div><span className="eyebrow">Best price</span><strong className="archive-price">{formatUsd(item.cheapest_price)}</strong></div>{item.max_savings_usd > 0 ? <span className="archive-save"><ArrowDownRight className="h-4 w-4" /> Save {formatUsd(item.max_savings_usd)}</span> : <span className="archive-save neutral"><ShieldCheck className="h-4 w-4" /> Verified</span>}</div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:px-10">
        <div className="grid gap-5 md:grid-cols-3">
          {[[Zap, "Search once", "One request wakes every collector and keeps polling while results arrive."], [ShieldCheck, "Compare cleanly", "Messy retailer payloads become one consistent price and product contract."], [Clock3, "Move on the signal", "Watch a product, inspect its history, and act when the price breaks."]].map(([Icon, title, copy], index) => {
            const FeatureIcon = Icon as typeof Zap;
            return <motion.div key={String(title)} custom={index} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={reveal} className="feature-card"><FeatureIcon className="h-5 w-5" /><span>0{index + 1}</span><h3>{String(title)}</h3><p>{String(copy)}</p><ArrowUpRight className="feature-arrow h-5 w-5" /></motion.div>;
          })}
        </div>
      </section>

      <PriceHistoryModal productId={modalProductId} isOpen={Boolean(modalProductId)} onClose={() => setModalProductId(null)} />
    </main>
  );
}
