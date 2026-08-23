"use client";
import { useMemo, useState } from "react";
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Legend,
  Area,
  ComposedChart,
} from "recharts";
import { TrendingDown, TrendingUp, Calendar } from "lucide-react";

interface PriceChartProps {
  history: Array<{ price: number; scraped_at?: string }>;
  forecast?: number[];
  average?: number;
  height?: number;
}

export default function PriceChart({
  history = [],
  forecast = [],
  average,
  height = 360,
}: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<"7D" | "14D" | "30D" | "60D" | "ALL">("ALL");

  // Unique gradient ids so multiple charts never collide in the DOM.
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const historyGradientId = `historyGradient-${uid}`;
  const forecastGradientId = `forecastGradient-${uid}`;

  // Sort history chronologically ascending
  const sortedHistory = useMemo(() => {
    const valid = history.filter(h => h && typeof h.price === "number" && h.price > 0);
    return [...valid].sort((a, b) => {
      const ta = a.scraped_at ? new Date(a.scraped_at).getTime() : 0;
      const tb = b.scraped_at ? new Date(b.scraped_at).getTime() : 0;
      return ta - tb;
    });
  }, [history]);

  let filteredHistory = [...sortedHistory];
  if (timeRange === "7D") {
    filteredHistory = sortedHistory.slice(-7);
  } else if (timeRange === "14D") {
    filteredHistory = sortedHistory.slice(-14);
  } else if (timeRange === "30D") {
    filteredHistory = sortedHistory.slice(-30);
  } else if (timeRange === "60D") {
    filteredHistory = sortedHistory.slice(-60);
  }

  const historyData = filteredHistory.map((h, i) => {
    const rawDate = h.scraped_at || "";
    let shortDate = `Day ${i + 1}`;
    if (rawDate.length >= 10) {
      const parts = rawDate.slice(0, 10).split("-");
      if (parts.length === 3) {
        shortDate = `${parts[1]}/${parts[2]}`;
      }
    }
    const isLast = i === filteredHistory.length - 1;
    return {
      date: shortDate,
      historyPrice: h.price,
      predictedPrice: isLast ? h.price : null,
      tooltipLabel: rawDate ? rawDate.slice(0, 10) : `Point ${i + 1}`,
      type: "historical",
    };
  });

  const forecastData = (forecast || []).map((p, i) => ({
    date: `+${i + 1}d`,
    historyPrice: null,
    predictedPrice: p,
    tooltipLabel: `ML Forecast (+${i + 1} Day)`,
    type: "forecast",
  }));

  const chartData = [...historyData, ...forecastData];

  const allPrices = [
    ...filteredHistory.map((h) => h.price),
    ...(forecast || []),
  ].filter((p) => typeof p === "number" && p > 0);

  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 100;
  const yMin = Math.max(0, Math.floor(minPrice * 0.94));
  const yMax = Math.ceil(maxPrice * 1.06);

  const currentPrice = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1].price : 0;
  const predictedEndPrice = forecast && forecast.length > 0 ? forecast[forecast.length - 1] : currentPrice;
  const priceDiff = predictedEndPrice - currentPrice;
  const pctChange = currentPrice > 0 ? (priceDiff / currentPrice) * 100 : 0;

  return (
    <div className="w-full space-y-4">
      {/* Top Controls: Timeframe Pills & Mini Insight */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">Range:</span>
          <div className="inline-flex rounded-xl bg-white/[0.04] p-1 border border-white/[0.08]">
            {(["7D", "14D", "30D", "60D", "ALL"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all duration-150 ${
                  timeRange === range
                    ? "bg-spidey-red text-white shadow-glow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {forecast && forecast.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono">
            <span className="text-gray-400">7D ML Projection:</span>
            <span
              className={`font-bold flex items-center gap-1 ${
                priceDiff < 0 ? "text-emerald-400" : priceDiff > 0 ? "text-spidey-red" : "text-gray-300"
              }`}
            >
              {priceDiff < 0 ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5" />
              )}
              {pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`}
            </span>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="w-full relative">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 10 }}>
            <defs>
              <linearGradient id={historyGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF2A54" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#FF2A54" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id={forecastGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00F2FE" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#00F2FE" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="date"
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "JetBrains Mono" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
            />

            <YAxis
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "JetBrains Mono" }}
              domain={[yMin, yMax]}
              tickFormatter={(val) => `$${val}`}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const price = payload[0].value;
                  const isPredicted = data.type === "forecast";
                  return (
                    <div className="bg-[#0C0E14]/95 backdrop-blur-2xl border border-white/15 p-3.5 rounded-2xl shadow-2xl text-xs min-w-[180px]">
                      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2">
                        <span className="text-gray-400 font-mono text-[11px] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-spidey-pop" />
                          {data.tooltipLabel}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isPredicted
                              ? "bg-cyan-950/80 text-spidey-cyan border border-cyan-700/50"
                              : "bg-red-950/80 text-spidey-red border border-red-800/50"
                          }`}
                        >
                          {isPredicted ? "FORECAST" : "SCRAPED"}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-gray-400 font-mono">Price:</span>
                        <span className="font-mono text-lg font-bold text-white">
                          ${Number(price).toFixed(2)}
                        </span>
                      </div>

                      {average && (
                        <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-gray-400">
                          <span>Diff vs Avg:</span>
                          <span
                            className={
                              Number(price) < average ? "text-emerald-400 font-semibold" : "text-spidey-red font-semibold"
                            }
                          >
                            {Number(price) < average ? "-" : "+"}
                            ${Math.abs(Number(price) - average).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: 12, fontSize: 11, fontFamily: "Plus Jakarta Sans" }}
              formatter={(value) => (
                <span className="text-gray-300 font-medium ml-1">
                  {value === "historyPrice" ? "Scraped Price History" : "scikit-learn 7-Day Prediction"}
                </span>
              )}
            />

            {average && (
              <ReferenceLine
                y={average}
                stroke="#FFD60A"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `AVG: $${average.toFixed(2)}`,
                  fill: "#FFD60A",
                  fontSize: 11,
                  fontFamily: "JetBrains Mono",
                  position: "insideTopRight",
                }}
              />
            )}

            {/* Historical Area & Line */}
            <Area
              type="monotone"
              dataKey="historyPrice"
              fill={`url(#${historyGradientId})`}
              stroke="none"
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="historyPrice"
              name="historyPrice"
              stroke="#FF2A54"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#FF2A54", stroke: "#060709", strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: "#FFD60A", stroke: "#FF2A54", strokeWidth: 2 }}
              connectNulls={false}
            />

            {/* Forecast Area & Line */}
            <Area
              type="monotone"
              dataKey="predictedPrice"
              fill={`url(#${forecastGradientId})`}
              stroke="none"
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="predictedPrice"
              name="predictedPrice"
              stroke="#00F2FE"
              strokeWidth={2.5}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: "#00F2FE", stroke: "#060709", strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: "#FFD60A", stroke: "#00F2FE", strokeWidth: 2 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
