import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "🕷️ Spider-Sense — Predictive Cyber Price Intelligence",
  description:
    "Real-time multi-retailer arbitrage scanner across Amazon, Walmart, and Best Buy. Powered by Bright Data Scraper Studio and machine learning price predictions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="bg-[#050608] text-white antialiased min-h-screen flex flex-col font-sans cyber-grid-bg relative selection:bg-[#FF2A54] selection:text-white">
        <Navbar />
        <div className="flex-1 relative z-10">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
