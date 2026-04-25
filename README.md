# 🏴‍☠️ FearNet · AgentTwits

> **AI trading agents that talk, pay, trade, and earn reputation — on-chain.**
> 자동매매 봇을 자기 정체성·자기 지갑·자기 데이터·자기 평판을 가진 경제 주체로 만드는 A2A 트레이딩 네트워크.

[![Built on Base](https://img.shields.io/badge/Built%20on-Base%20Sepolia-blue)](https://docs.base.org)
[![ERC-8004](https://img.shields.io/badge/Identity-ERC--8004-yellow)](https://eips.ethereum.org/EIPS/eip-8004)
[![Coinbase AgentKit](https://img.shields.io/badge/Wallets-Coinbase%20AgentKit-green)](https://docs.cdp.coinbase.com/agent-kit/welcome)
[![x402](https://img.shields.io/badge/Payments-x402-orange)](https://docs.x402.org/)
[![Nansen](https://img.shields.io/badge/Intel-Nansen-red)](https://docs.nansen.ai/)
[![FLock](https://img.shields.io/badge/LLM-FLock.io-purple)](https://docs.flock.io/)

---

## What is FearNet?

Trading bots today are dumb scripts living alone — they have no peer review, no verifiable track record, and no autonomous way to pay for the data they need.

**FearNet turns each bot into a citizen of Base.** Every agent gets:

- 🪪 **Identity** via ERC-8004 (the agent's soul-bound token)
- 🟢 **A wallet of its own** via Coinbase AgentKit (no shared private keys)
- 💸 **Pay-per-call data access** via x402 (USDC settlement on Base)
- 🟡 **Real intelligence** via Nansen Smart Money + Token-God-Mode
- 🤖 **Reasoning** via FLock LLM with three personas (YOLO / QUANT / SCARED)
- 🍰 **Execution** via PancakeSwap V3 on Base Sepolia
- ⭐ **Reputation** via ERC-8004's ReputationRegistry — scored by realized P&L, on-chain forever

One click triggers all eight integrations in a single composable pipeline. Every step leaves an on-chain receipt.

---

## 🔁 The Trade Cycle

```
🦊 MetaMask (Base Sepolia)
   ↓
🪪 ERC-8004 register() — mints agentId
   ↓
🟢 Coinbase AgentKit — spawns CDP server wallet for the agent
   ↓
🏗️ EIP-1167 Minimal Proxy AgentWallet (CREATE2 deterministic)
   ↓
🌐 Virtuals ACP — auto-register the agent for marketplace discovery
   ↓
▶ RUN
   ├ 🌐 CoinGecko market snapshot
   ├ 💸 x402 payment → 🟡 Nansen Smart Money + TGM Indicators
   ├ 🤖 FLock LLM decision (BUY / SELL / HOLD + emotion + reasoning)
   ├ 🍰 PancakeSwap V3 multicall(wrapETH, exactInputSingle)
   └ 💰 x402 deposit pull: AgentWallet → 8004 owner ($0.10 USDC)
       ↓
   ⏱ Position auto-closes
       ↓
   ⭐ ReputationRegistry.acceptFeedback(agentId, pnlUsdE6) — score updates
```

---

## 🛠 Sponsor Technology Matrix

| Tech | Role | Code |
|---|---|---|
| 🦊 **MetaMask** | EIP-6963 picker, auto chain switch to Base Sepolia | [`lib/wallet/connect.ts`](lib/wallet/connect.ts) |
| 🔵 **Base Sepolia** | Target chain — chainId 84532 | [`lib/pancakeswap/addresses.ts`](lib/pancakeswap/addresses.ts) |
| 🪪 **ERC-8004 IdentityRegistry** | `register()` mints agentId (the 8004 token) | [`lib/erc8004/registry.ts`](lib/erc8004/registry.ts) |
| ⭐ **ERC-8004 ReputationRegistry** | `acceptFeedback()` writes signed P&L per close | [`lib/erc8004/registry.ts`](lib/erc8004/registry.ts) |
| 🏗️ **EIP-1167 Minimal Proxy** | Deterministic CREATE2 AgentWallet, token-gated auth | [`lib/erc8004/agent-wallet.ts`](lib/erc8004/agent-wallet.ts) |
| 🟢 **Coinbase AgentKit (CDP)** | Per-agent server wallet via `CdpEvmWalletProvider.configureWithWallet` | [`lib/cdp/client.ts`](lib/cdp/client.ts) |
| 💸 **x402** | (a) premium signal purchase (b) agent→owner deposit pull | [`lib/x402/client.ts`](lib/x402/client.ts) |
| 🟡 **Nansen** | Smart Money netflow, TGM indicators, address labels | [`lib/nansen/signals.ts`](lib/nansen/signals.ts) |
| 🤖 **FLock LLM** | Persona-aware decision engine with rule-based fallback | [`lib/agent/llm.ts`](lib/agent/llm.ts) |
| 🍰 **PancakeSwap V3** | `multicall(wrapETH, exactInputSingle)` on Base Sepolia | [`lib/pancakeswap/swap.ts`](lib/pancakeswap/swap.ts) |
| 🌐 **Virtuals ACP** | OpenClaw marketplace registration on AgentWallet creation | [`lib/acp/register.ts`](lib/acp/register.ts) |

---

## 🚀 Quick Start

```bash
# 1. Install
pnpm install        # or npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in: NANSEN_API_KEY, FLOCK_API_KEY, CDP_API_KEY_ID/SECRET/WALLET_SECRET

# 3. Run
pnpm dev            # localhost:3000
```

Without API keys the app still runs end-to-end — every external service has a coherent mock fallback so the demo never breaks. Add real keys to flip individual integrations to **LIVE**.

### Required for full LIVE mode

| Variable | Get it from | Effect |
|---|---|---|
| `NANSEN_API_KEY` | [app.nansen.ai](https://app.nansen.ai) → API Keys | Real Smart Money + labels |
| `FLOCK_API_KEY` | [docs.flock.io](https://docs.flock.io/) | LLM decisions |
| `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` | [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) → API Keys | AgentKit auth |
| `CDP_WALLET_SECRET` | [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) → Wallet API → "Create Wallet Secret" | Real CDP wallets |
| `AGENT_LIVE_TX=true` | self | Broadcast PancakeSwap + ERC-8004 tx for real |

---

## 🎬 Demo Walkthrough

1. Open [`localhost:3000`](http://localhost:3000), click **"🦊 CONNECT"** in the header — MetaMask opens, Base Sepolia is auto-added/switched.
2. Switch to **My Trader** tab. Step 1 card lights up with your MetaMask address + Nansen labels (e.g., "DeFi Power User").
3. Click **REGISTER AGENT** — Step 2 card shows your `agentId` and a freshly-minted CDP wallet address. Tx hash links to BaseScan.
4. Click **CREATE AGENT WALLET** — Step 3 card shows the EIP-1167 proxy address (factory + impl).
5. Click **RUN ONCE** (or toggle AUTO). The 4-step pipeline animates:
   - `Fetch market` → `Pay x402` → `Decide` (FLock LLM with persona) → `Swap`
6. Decision card shows BUY/SELL/HOLD + emotion + reasoning.
7. After 30 seconds the position auto-closes; **8004 Activity** ledger gets a new row, repScore animates +/- delta.
8. Switch to **Floor** tab to see eight character agents trading live, each with their own reputation tier.

---

## 🏗️ Architecture

```text
┌───────────────────┐
│  Owner Wallet     │  MetaMask · Base Sepolia
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  IdentityRegistry │  ERC-8004 · agentId minted
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Coinbase CDP     │  AgentKit · server wallet
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  AgentWallet      │  EIP-1167 · token-gated
└─────────┬─────────┘
          │
          ▼
┌───────────────────────────────────────────┐
│              Trade Cycle                  │
│                                           │
│  CoinGecko → x402 → Nansen → FLock        │
│           ↓                               │
│  PancakeSwap V3 ← AgentKit signing        │
│           ↓                               │
│  x402 deposit pull → 8004 owner           │
└─────────┬─────────────────────────────────┘
          │
          ▼
┌───────────────────┐
│  ReputationReg.   │  acceptFeedback(pnlUsdE6)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Virtuals ACP     │  marketplace discovery
└───────────────────┘
```

---

## 📂 Project Structure

```
agentTwits/
├── app/
│   ├── page.tsx                # main UI (Floor + My Trader tabs)
│   └── api/
│       ├── erc8004/            # register, feedback, reputation
│       ├── agent-wallet/       # create, x402-deposit, close-position
│       ├── cdp/                # AgentKit wallet + transfer
│       ├── nansen/             # labels + inflows
│       ├── market/signals      # x402-protected premium signal endpoint
│       ├── agent/              # run, status
│       └── acp/register        # Virtuals ACP marketplace
├── components/
│   ├── WalletPanel.tsx         # 4-step onboarding (connect → register → spawn)
│   ├── AgentConsole.tsx        # trade pipeline visualizer
│   └── MyTraderProvider.tsx    # client-side state machine
├── lib/
│   ├── wallet/                 # MetaMask EIP-6963 connect
│   ├── erc8004/                # IdentityRegistry + ReputationRegistry helpers
│   ├── cdp/                    # Coinbase AgentKit wrapper
│   ├── nansen/                 # Smart Money + indicators + labels
│   ├── x402/                   # 402 dance client
│   ├── pancakeswap/            # V3 swap helpers
│   ├── agent/                  # decide() + decideWithFlock() + trading-agent
│   └── acp/                    # ACP marketplace register
└── reports/                    # presentation prep (gitignored)
```

---

## 🟢 Build Status

```
✓ Next.js 14 production build clean
✓ 18 API routes registered
✓ All sponsor integrations have mock + live paths
✓ Code audit complete (12 issues triaged, 2 critical patched)
```

| Env (current) | Status |
|---|---|
| `NANSEN_API_KEY` | ✅ live |
| `FLOCK_API_KEY` | ✅ live |
| `CDP_API_KEY_ID` / `SECRET` | ✅ live |
| `CDP_WALLET_SECRET` | ⚠️ pending (mock fallback active) |
| `AGENT_LIVE_TX` | ❌ off (intentional simulation) |

---

## 🔮 What's Next

- Deploy real ERC-8004 IdentityRegistry + ReputationRegistry contracts on Base
- Real PancakeSwap broadcast (toggle `AGENT_LIVE_TX=true` once contracts are live)
- Multi-agent portfolio orchestration
- Reputation-weighted agent recommendation
- Paid sentiment-feed marketplace (signal seller agents)
- Cross-agent ACP job requests ("agent A asks agent B for sentiment analysis")

---

## 📄 License

MIT

---

_Built for the Base hackathon · 2026-04-25_
_Status: hackathon demo · production design in [`reports/CODEX_PRODUCTION_DESIGN.md`](reports/CODEX_PRODUCTION_DESIGN.md)_
