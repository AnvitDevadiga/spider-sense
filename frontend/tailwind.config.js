/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        spidey: {
          red: "#FF2A54",
          crimson: "#E63946",
          darkred: "#9B111E",
          blue: "#1D3557",
          deepblue: "#101B2B",
          navy: "#0A0F1D",
          black: "#06070B",
          darkcard: "#0E111C",
          darkcard2: "#141829",
          darkborder: "#20263D",
          borderlight: "rgba(255, 255, 255, 0.08)",
          pop: "#FFD60A",
          gold: "#FFE043",
          cyan: "#00F2FE",
          cyanlight: "#4CC9F0",
          purple: "#8B5CF6",
          emerald: "#10B981",
          cream: "#F8FAFC",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Outfit", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        comic: ["Bangers", "Impact", "sans-serif"],
        mono: ["JetBrains Mono", "Space Mono", "Courier New", "monospace"],
      },
      boxShadow: {
        glow: "0 0 35px rgba(255, 42, 84, 0.4)",
        glowlg: "0 0 50px rgba(255, 42, 84, 0.6)",
        glowyellow: "0 0 30px rgba(255, 214, 10, 0.4)",
        glowcyan: "0 0 30px rgba(0, 242, 254, 0.4)",
        glowemerald: "0 0 30px rgba(16, 185, 129, 0.4)",
        comic: "4px 4px 0 #000",
        comiclg: "6px 6px 0 #000",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.5)",
      },
      animation: {
        "spin-slow": "spin 20s linear infinite",
        "pulse-fast": "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-slow": "bounce 3s infinite",
        "radar-sweep": "radar-sweep 4s linear infinite",
        "spider-pulse": "spider-pulse 3s ease-in-out infinite",
        "float": "float-slow 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
