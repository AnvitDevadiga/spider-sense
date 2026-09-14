"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingDown, TrendingUp, DollarSign, Activity, Cpu, Sparkles } from "lucide-react";
import { API, formatUsd } from "@/lib/site";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface PriceHistoryModalProps {
  productId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PriceHistoryModal({ productId, isOpen, onClose }: PriceHistoryModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !productId) return;
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/products/${encodeURIComponent(productId)}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [isOpen, productId]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-xl"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-3xl bg-[#090C12]/95 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden z-10"
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-spidey-red/10 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-spidey-cyan/10 blur-[100px] pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2.5 rounded-full bg-white/5 hover:bg-white/15 transition text-gray-400 hover:text-white border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-10 h-10 border-3 border-spidey-cyan border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-mono text-gray-400 tracking-wider">
                  Extracting Machine Learning Forecast...
                </p>
              </div>
            ) : data ? (
              <div>
                <div className="mb-6 pr-12">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-spidey-cyan text-[10px] font-mono font-bold uppercase tracking-widest mb-2">
                    <Cpu className="w-3 h-3" />
                    Machine Learning Intelligence
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white line-clamp-1 tracking-tight">
                    {data.product?.title || "Price intelligence"}
                  </h2>
                  <p className="text-gray-400 text-xs mt-1 font-mono">
                    {data.product?.brand || "Verified Retailer"} • {data.product?.category || "Consumer Electronics"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/[0.04] border border-white/10 p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                        Current Price
                      </p>
                      <p className="text-xl sm:text-2xl font-extrabold font-mono text-white">
                        {formatUsd(data.product?.current_price || data.price_history?.at(-1)?.price || 0)}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`border p-4 rounded-2xl flex items-center gap-4 ${
                      data.prediction?.action === "BUY_NOW"
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : "bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                      {data.prediction?.action === "BUY_NOW" ? (
                        <TrendingDown className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <TrendingUp className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider opacity-80 font-bold">
                        AI Arbitrage Verdict
                      </p>
                      <p className="text-xl sm:text-2xl font-extrabold font-mono">
                        {data.prediction?.action?.replace('_', ' ') || "UNKNOWN"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="h-64 w-full bg-black/60 rounded-2xl border border-white/10 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.price_history ? [...data.price_history].reverse() : []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="scraped_at"
                        tickFormatter={(val) =>
                          new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                        }
                        stroke="rgba(255,255,255,0.3)"
                        fontSize={10}
                        fontFamily="JetBrains Mono"
                      />
                      <YAxis
                        domain={["dataMin - 10", "dataMax + 10"]}
                        tickFormatter={(val) => `$${val}`}
                        stroke="rgba(255,255,255,0.3)"
                        fontSize={10}
                        fontFamily="JetBrains Mono"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0C0E14",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.8)",
                          fontFamily: "JetBrains Mono",
                          fontSize: "11px",
                        }}
                        itemStyle={{ color: "#fff" }}
                        labelFormatter={(val) => new Date(val).toLocaleString()}
                      />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#FF2A54"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#FF2A54", strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "#FFD60A", stroke: "#FF2A54", strokeWidth: 2 }}
                      />
                      {data.prediction?.forecast_next_7d && data.prediction.forecast_next_7d.length === 7 && (
                        <ReferenceLine
                          y={data.prediction.forecast_next_7d[6]}
                          stroke="#10B981"
                          strokeDasharray="4 4"
                          label={{
                            position: "top",
                            value: "7D ML Projection",
                            fill: "#10B981",
                            fontSize: 10,
                            fontFamily: "JetBrains Mono",
                          }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {data.prediction?.confidence !== undefined && (
                  <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-spidey-pop" />
                    <span>
                      ML Model Confidence Score:{" "}
                      <strong className="text-white">
                        {data.prediction.confidence}%
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-24 text-center text-gray-500 font-mono text-sm">
                No historical price records found for this product.
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
