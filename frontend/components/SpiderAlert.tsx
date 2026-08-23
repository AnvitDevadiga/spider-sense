"use client";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import {
  Flame,
  ArrowDownRight,
  Package,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { formatUsd, storeMeta, timeAgo } from "@/lib/site";

interface SpiderAlertProps {
  id?: number;
  productId: string;
  alertType: string;
  message: string;
  oldPrice?: number;
  newPrice?: number;
  dropPercent?: number;
  productTitle?: string;
  productImage?: string;
  productSource?: string;
  createdAt?: string;
}

export default function SpiderAlert({
  productId,
  alertType,
  message,
  oldPrice,
  newPrice,
  dropPercent,
  productTitle,
  productImage,
  productSource,
  createdAt,
}: SpiderAlertProps) {
  const isLowestEver = alertType === "lowest_ever";
  const isStock = alertType === "back_in_stock";

  const storeStyle = storeMeta(productSource);
  const relativeTime = timeAgo(createdAt);

  return (
    <div className="h-full">
      <Link
        href={`/product/${encodeURIComponent(productId)}`}
        className={`group flex flex-col justify-between h-full p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden backdrop-blur-2xl ${
          isLowestEver
            ? "bg-[#110E14]/90 border-spidey-red/40 hover:border-spidey-red hover:-translate-y-1 shadow-[0_4px_25px_rgba(255,42,84,0.15)]"
            : isStock
            ? "bg-[#0E1314]/90 border-emerald-500/40 hover:border-emerald-400 hover:-translate-y-1 shadow-[0_4px_25px_rgba(16,185,129,0.15)]"
            : "glass-card bg-black/60 hover:-translate-y-1 hover:border-white/20"
        }`}
      >
        {/* Top Header Tag Row */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${
                isLowestEver
                  ? "bg-spidey-red text-white border-red-400 shadow-[0_0_12px_rgba(255,42,84,0.5)]"
                  : isStock
                  ? "bg-emerald-500 text-black border-emerald-300 font-bold shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                  : "bg-spidey-pop text-black border-yellow-300 font-bold"
              }`}
            >
              {isLowestEver ? (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>ALL-TIME LOW</span>
                </>
              ) : isStock ? (
                <>
                  <Package className="w-3 h-3" />
                  <span>BACK IN STOCK</span>
                </>
              ) : (
                <>
                  <Flame className="w-3 h-3 fill-black" />
                  <span>{dropPercent ? `${dropPercent.toFixed(0)}% OFF` : "PRICE DROP"}</span>
                </>
              )}
            </span>

            {productSource && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${storeStyle.badge}`}
              >
                {storeStyle.label}
              </span>
            )}
          </div>

          {/* Main Info: Thumbnail + Title */}
          <div className="flex gap-3.5 items-center">
            <div className="w-13 h-13 rounded-xl overflow-hidden bg-black/70 border border-white/10 flex-shrink-0 flex items-center justify-center p-1 shadow-inner">
              <ProductImage
                src={productImage}
                alt={productTitle || "Product thumbnail"}
                source={productSource}
                fallbackSize="sm"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-white group-hover:text-spidey-pop transition-colors line-clamp-1 leading-snug tracking-tight">
                {productTitle || "Tracked Product Deal"}
              </h4>
              <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1 font-mono">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Delta & Footer Action */}
        <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            {newPrice != null && (
              <span className="font-mono text-xl font-extrabold text-spidey-pop">
                {formatUsd(newPrice)}
              </span>
            )}

            {oldPrice != null && oldPrice !== newPrice && (
              <span className="text-xs text-gray-500 line-through font-mono">
                {formatUsd(oldPrice)}
              </span>
            )}

            {dropPercent != null && dropPercent > 0 && (
              <span className="text-xs font-mono font-bold text-emerald-400 flex items-center">
                <ArrowDownRight className="w-3.5 h-3.5" />
                {dropPercent.toFixed(0)}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-spidey-cyan group-hover:text-white transition-colors">
            {relativeTime && (
              <span className="text-[10px] text-gray-500 font-normal">{relativeTime}</span>
            )}
            <span>View Deal</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </Link>
    </div>
  );
}
