"use client";

export default function HeroGlobe() {
  return (
    <div className="relative w-56 h-56 sm:w-72 sm:h-72 mx-auto flex items-center justify-center select-none">
      {/* Outer subtle glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-spidey-red/20 via-spidey-cyan/15 to-spidey-pop/15 blur-2xl pointer-events-none" />

      {/* Layer 1: Spinning dashed ring */}
      <div className="absolute inset-0 rounded-full border border-dashed border-spidey-red/30 animate-spin-cw" />

      {/* Layer 2: Counter-rotating cyan ring */}
      <div className="absolute inset-4 rounded-full border border-spidey-cyan/30 animate-spin-ccw">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-spidey-cyan shadow-[0_0_8px_#00F2FE]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-spidey-cyan shadow-[0_0_8px_#00F2FE]" />
        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-spidey-pop shadow-[0_0_8px_#FFD60A]" />
        <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-spidey-pop shadow-[0_0_8px_#FFD60A]" />
      </div>

      {/* Layer 3: Radar Scanner */}
      <div className="absolute inset-8 rounded-full overflow-hidden border border-white/10 bg-[#090D16]">
        {/* Sweeping radar beam */}
        <div
          className="absolute top-1/2 left-1/2 w-full h-full origin-top-left pointer-events-none animate-spin-radar"
          style={{
            background:
              "conic-gradient(from 0deg at 0% 0%, rgba(255, 42, 84, 0.35) 0deg, rgba(0, 242, 254, 0.08) 45deg, transparent 90deg)",
          }}
        />

        {/* Crosshair lines */}
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-spidey-cyan/20 -translate-y-1/2" />
        <div className="absolute top-0 left-1/2 w-[1px] h-full bg-spidey-cyan/20 -translate-x-1/2" />
      </div>

      {/* Layer 4: Concentric Inner Rings */}
      <div className="absolute inset-16 rounded-full border border-spidey-pop/25" />
      <div className="absolute inset-24 rounded-full border border-spidey-red/35" />

      {/* Center Holographic Spider Emblem */}
      <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-spidey-red via-[#800A1F] to-[#0A0D14] border border-spidey-pop/60 flex items-center justify-center shadow-glow animate-pulse-subtle">
        <span className="text-3xl sm:text-4xl">🕷️</span>
      </div>

      {/* Orbiting Retailer Badges */}
      <div className="absolute inset-0 pointer-events-none animate-spin-cw">
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/90 border border-yellow-400 text-[10px] font-mono text-yellow-300 font-bold shadow-md">
          AMZ
        </span>
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/90 border border-blue-400 text-[10px] font-mono text-blue-300 font-bold shadow-md">
          WMT
        </span>
        <span className="absolute -right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-black/90 border border-cyan-400 text-[10px] font-mono text-cyan-300 font-bold shadow-md">
          BBY
        </span>
      </div>
    </div>
  );
}
