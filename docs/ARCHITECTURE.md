# StellarPay Agent — Architecture

**Version**: 1.0 | **Network**: Stellar Testnet | **Phase**: 1

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                          │
│                    Next.js Dashboard (3000)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────▼────────────────────────────────────┐
│                    Express API Server (3001)                    │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │  Auth    │  │ Agent Routes │  │   Payment Routes        │   │
│  │ /auth/*  │  │  /agents/*   │  │    /payments/*          │   │
│  └──────────┘  └──────────────┘  └────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  stellar-core Package                    │  │
│  │  wallet.ts │ payments.ts │ limits.ts                     │  │
│  └──────────────────────────┬─────────────────────────────-┘  │
│                              │                                  │
│  ┌──────────────────────────▼──────────────────────────────┐  │
│  │                  SQLite Database                        │  │
│  │  users │ agents │ transactions                          │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ Stellar SDK
┌────────────────────────────▼────────────────────────────────────┐
│                  Stellar Testnet (Horizon API)                  │
│         https://horizon-testnet.stellar.org                     │
│                                                                 │
│   Friendbot (account funding)                                   │
│   Horizon (balance, transactions, submission)                   │
│   Testnet Explorer: testnet.stellar.expert                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. `packages/stellar-core`

Shared library with no web framework dependency. Wraps `@stellar/stellar-sdk`.

| Module | Responsibility |
|--------|---------------|
| `wallet.ts` | Keypair generation, Friendbot funding, USDC trustline |
| `payments.ts` | Payment execution, balance fetching, tx history |
| `limits.ts` | SpendingLimitChecker — validates against daily/per-tx limits |
| `index.ts` | Public exports |

**Key Design Decisions:**
- No state stored in stellar-core — it is purely functional
- All Stellar operations are async with proper error typing
- Network is configurable (testnet/mainnet) via env var

### 2. `apps/api` — Express Backend

**Database Schema:**

```sql
-- Users table
CREATE TABLE users (
  id          TEXT PRIMARY KEY,   -- UUID
  email       TEXT UNIQUE,
  password    TEXT,               -- bcrypt hash
  created_at  TEXT
);

-- Agents table  
CREATE TABLE agents (
  id                  TEXT PRIMARY KEY,   -- UUID
  user_id             TEXT,
  name                TEXT,
  description         TEXT,
  public_key          TEXT UNIQUE,
  encrypted_secret    TEXT,              -- AES-256-GCM encrypted
  asset               TEXT,             -- 'USDC' | 'XLM'
  daily_limit         REAL,             -- in asset units
  per_tx_limit        REAL,
  daily_spent         REAL DEFAULT 0,
  last_reset_at       TEXT,
  is_revoked          INTEGER DEFAULT 0,
  created_at          TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Transactions table
CREATE TABLE transactions (
  id              TEXT PRIMARY KEY,   -- UUID
  agent_id        TEXT,
  user_id         TEXT,
  tx_hash         TEXT,              -- Stellar transaction hash
  amount          REAL,
  asset           TEXT,
  destination     TEXT,              -- recipient public key
  memo            TEXT,
  status          TEXT,              -- 'success' | 'failed' | 'rejected'
  rejection_reason TEXT,
  created_at      TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);
```

**API Routes:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create user account |
| POST | `/auth/login` | Login, return JWT |
| GET | `/auth/me` | Get current user |
| POST | `/agents` | Create new agent wallet |
| GET | `/agents` | List user's agents |
| GET | `/agents/:id` | Agent detail + balance |
| PUT | `/agents/:id/limits` | Update spending limits |
| PUT | `/agents/:id/revoke` | Revoke agent |
| POST | `/payments` | Execute payment |
| GET | `/payments` | List user's transactions |
| GET | `/payments/agent/:agentId` | Transactions for one agent |

### 3. `apps/web` — Next.js Dashboard

**Page Structure:**

```
/                     Landing page
/login                Authentication
/register             New account
/dashboard            Overview stats
/agents               Agent list
/agents/[id]          Agent detail
/transactions         Full tx log
```

**Key Components:**
- `SpendingGauge` — animated progress bar showing daily spend vs limit
- `AgentCard` — status badge, balance, quick actions
- `TransactionTable` — sortable table with explorer links
- `LimitEditor` — modal form to update limits
- `RevokeModal` — confirmation dialog with warning

---

## Security Architecture

### Secret Key Storage (Phase 1)
```
Agent Creation:
  1. Generate Stellar keypair (randomBytes)
  2. Encrypt secretKey with AES-256-GCM using SERVER_ENCRYPTION_KEY
  3. Store { publicKey, encryptedSecret, iv, authTag } in DB
  4. NEVER return secretKey in API response

Payment Execution:
  1. Load encryptedSecret from DB
  2. Decrypt in-memory only for transaction signing
  3. Sign transaction
  4. Clear key from memory
  5. Submit signed transaction to Stellar
```

### JWT Authentication
- Token expiry: 24 hours
- Stored in httpOnly cookie (web) or Authorization header (API)
- Agent routes: validate ownership (agent.user_id === request.user.id)

---

## Payment Flow

```
POST /payments
  │
  ├─ 1. Authenticate user (JWT)
  ├─ 2. Load agent from DB
  ├─ 3. Verify agent.user_id === user.id
  ├─ 4. Check is_revoked === false
  ├─ 5. Check amount <= per_tx_limit
  ├─ 6. Check (daily_spent + amount) <= daily_limit
  ├─ 7. Fetch Stellar account balance
  ├─ 8. Check balance >= amount + fees
  ├─ 9. Decrypt agent secret key
  ├─ 10. Build + sign Stellar transaction
  ├─ 11. Submit to Horizon
  ├─ 12. Record tx in DB (success)
  ├─ 13. Update daily_spent += amount
  └─ 14. Return { txHash, explorerUrl }
```

---

## Phase 2+ Architecture Extensions

### Phase 2: Merchant Whitelist
```sql
CREATE TABLE merchant_whitelist (
  agent_id       TEXT,
  public_key     TEXT,   -- approved destination
  label          TEXT,
  PRIMARY KEY (agent_id, public_key)
);
```

### Phase 3: x402 Integration
```
HTTP Request → x402 Middleware → Parse 402 Challenge
→ Call POST /payments → Return signed payment proof
→ Retry original request with payment proof
```

### Phase 4: Soroban Smart Contract
```rust
// SpendingLimitContract
pub fn transfer(env: Env, agent: Address, to: Address, amount: i128) -> Result<(), Error> {
    // On-chain limit enforcement
    let daily_spent = env.storage().get(&agent).unwrap_or(0);
    let daily_limit = env.storage().get(&(agent, "limit")).unwrap();
    require!(daily_spent + amount <= daily_limit, Error::LimitExceeded);
    // Execute SAC transfer
}
```
