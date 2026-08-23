"use client";
import { useState, useEffect } from "react";
import {
  Headphones,
  Tablet,
  Laptop,
  Smartphone,
  HardDrive,
  Gamepad2,
  Tv,
  ShoppingBag,
  Sparkles,
  ImageIcon,
} from "lucide-react";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  category?: string | null;
  source?: string | null;
  fallbackSize?: "sm" | "md" | "lg";
}

export default function ProductImage({
  src,
  alt,
  className = "w-full h-full object-cover",
  category,
  source,
  fallbackSize = "md",
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(src || null);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
    setLoaded(false);
    setImageSrc(src || null);
  }, [src]);

  const catLower = (category || "").toLowerCase();

  const getCategoryIcon = () => {
    if (catLower.includes("headphone") || catLower.includes("audio") || catLower.includes("sound")) {
      return Headphones;
    }
    if (catLower.includes("tablet") || catLower.includes("ipad")) {
      return Tablet;
    }
    if (catLower.includes("laptop") || catLower.includes("macbook") || catLower.includes("pc")) {
      return Laptop;
    }
    if (catLower.includes("phone") || catLower.includes("mobile") || catLower.includes("galaxy")) {
      return Smartphone;
    }
    if (catLower.includes("storage") || catLower.includes("ssd") || catLower.includes("drive")) {
      return HardDrive;
    }
    if (catLower.includes("gaming") || catLower.includes("console") || catLower.includes("game") || catLower.includes("switch") || catLower.includes("ps5")) {
      return Gamepad2;
    }
    if (catLower.includes("display") || catLower.includes("tv") || catLower.includes("monitor")) {
      return Tv;
    }
    return ShoppingBag;
  };

  const IconComponent = getCategoryIcon();

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-7 h-7",
    lg: "w-10 h-10",
  };

  const renderFallback = () => (
    <div className="w-full h-full min-h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0e121a] to-[#080a0e] border border-white/[0.08] relative overflow-hidden select-none p-3 text-center">
      {/* Ambient subtle glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,42,84,0.12),transparent_70%)]" />
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:16px_16px]" />

      <div className="relative z-10 flex flex-col items-center justify-center gap-1.5">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-spidey-cyan shadow-inner">
          <IconComponent className={`${iconSizes[fallbackSize]} text-spidey-cyan`} />
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-gray-400">
          <Sparkles className="w-2.5 h-2.5 text-spidey-red" />
          <span>{category || source || "Spider-Sense"}</span>
        </div>
      </div>
    </div>
  );

  // Local SVG placeholder as alternative (used when image fails and we want a realistic placeholder)
  const localPlaceholder = "/placeholder.svg";

  if (!imageSrc || hasError) {
    return renderFallback();
  }

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black/40">
      <img
        src={imageSrc}
        alt={alt}
        className={`${className} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-200`}
        loading="lazy"
        referrerPolicy={imageSrc?.includes("unsplash.com") ? undefined : "no-referrer"}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setHasError(true);
          setImageSrc(null);
        }}
      />
      {!loaded && (
        <div className="absolute inset-0 bg-white/[0.02] animate-pulse flex items-center justify-center">
          <span className="text-xl opacity-30">🕷️</span>
        </div>
      )}
    </div>
  );
}
