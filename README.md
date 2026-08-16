# StellarPay Agent 🚀

> A permission-based payment infrastructure for AI agents on the Stellar network.

[![Phase](https://img.shields.io/badge/Phase-1%20Complete-brightgreen)]()
[![Network](https://img.shields.io/badge/Network-Stellar%20Testnet-blue)]()
[![Asset](https://img.shields.io/badge/Asset-USDC%20%2F%20XLM-purple)]()

## Overview

StellarPay Agent allows users to provision AI agents with Stellar wallets and fine-grained spending controls. Agents can autonomously make small payments for APIs, data, and digital services — while the user retains full control via daily limits, per-transaction caps, merchant whitelists, and instant revocation.

## Architecture

```
stellarpay-agent/
├── apps/
│   ├── web/          # Next.js 14 Dashboard (port 3000)
│   └── api/          # Express REST API (port 3001)
├── packages/
│   └── stellar-core/ # Shared Stellar SDK utilities
└── docs/
    ├── PRD.md
    └── ARCHITECTURE.md
```

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+

### Setup

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/stellarpay-agent.git
cd stellarpay-agent
npm install

# Configure API environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your secrets

# Start both servers
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Phase 1 Features

- ✅ User authentication (register/login)
- ✅ Agent wallet provisioning on Stellar Testnet
- ✅ USDC & XLM spending limits (daily + per-transaction)
- ✅ Payment execution with limit enforcement
- ✅ Instant agent revocation
- ✅ Full transaction log (on-chain verification links)
- ✅ Real-time balance display

## Roadmap

| Phase | Feature |
|-------|---------|
| Phase 1 | Core infrastructure (current) |
| Phase 2 | Approved merchant lists, recurring allowances, webhooks |
| Phase 3 | x402 protocol, AI Agent HTTP SDK |
| Phase 4 | Soroban smart contracts, mainnet, security audit |

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Custom CSS
- **Backend**: Express, TypeScript, SQLite
- **Blockchain**: `@stellar/stellar-sdk`, Stellar Testnet (Horizon)

## License

MIT
