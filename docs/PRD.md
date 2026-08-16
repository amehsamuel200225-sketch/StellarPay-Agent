# StellarPay Agent — Product Requirements Document (PRD)

**Version**: 1.0  
**Date**: August 2026  
**Status**: Active Development

---

## 1. Executive Summary

StellarPay Agent is a permission-based payment infrastructure enabling AI agents to autonomously execute micropayments on the Stellar blockchain using USDC and XLM. It addresses a fundamental gap in the emerging agentic economy: how do you give an AI agent financial autonomy without losing control?

The solution is a **user-controlled permission layer** that enforces spending rules on-chain and in real-time — agents get just enough financial autonomy to be useful, and users retain full, instant revocation capability.

---

## 2. Problem Statement

As AI agents become more capable and autonomous, they increasingly need to pay for external resources:
- API calls to data providers
- Access to premium AI inference endpoints
- Digital service subscriptions
- On-demand compute resources

Current solutions force a choice between:
- **Manual approval**: User must authorize every payment (defeats the purpose of an autonomous agent)
- **Full wallet access**: Agent has unrestricted access (too dangerous, no auditability)

There is no middle ground with enforceable rules, real-time limits, and audit trails.

---

## 3. Goals & Success Metrics

### Phase 1 Goals
- [ ] User can register, log in, and create agent wallets
- [ ] Each agent wallet has configurable daily and per-transaction spending limits
- [ ] Agent can execute USDC/XLM payments within limits
- [ ] Payments exceeding limits are rejected before transaction submission
- [ ] User can revoke (freeze) an agent wallet instantly
- [ ] Full transaction log with Stellar Explorer links
- [ ] Balance display in real-time from Stellar Horizon API

### Success Metrics
| Metric | Target |
|--------|--------|
| Payment execution time | < 5 seconds (Stellar finality) |
| Limit enforcement accuracy | 100% — no overspend |
| Revocation effectiveness | Instant — 0 transactions post-revoke |
| Transaction log completeness | 100% of submitted tx recorded |

---

## 4. User Stories

### Core User Stories

**US-001** — As a user, I want to create a Stellar agent wallet so my AI agent can make payments autonomously.

**US-002** — As a user, I want to set a daily spending limit (e.g., $20/day) so my agent cannot overspend.

**US-003** — As a user, I want to set a per-transaction limit (e.g., $5 max per payment) to prevent large unauthorized charges.

**US-004** — As a user, I want to see all transactions my agent made with timestamps, amounts, and on-chain proof.

**US-005** — As a user, I want to instantly revoke my agent's payment ability if I detect suspicious activity.

**US-006** — As an AI agent (API caller), I want to submit a payment request that gets validated and executed if within limits.

**US-007** — As a user, I want to see my agent's current balance (USDC + XLM) in real-time.

---

## 5. Functional Requirements

### 5.1 Authentication
- Email + password registration and login
- JWT-based session management (24h tokens)
- Password hashed with bcrypt

### 5.2 Agent Management
- Create agent: generates Stellar keypair, funds via Friendbot (testnet), establishes USDC trustline
- Store encrypted secret key (AES-256) in database
- Configure: name, description, daily limit, per-tx limit, asset preference (USDC/XLM)
- Revoke: set `is_revoked = true`, all future payments rejected immediately

### 5.3 Payment Execution
- Input: `{ agentId, destinationPublicKey, amount, asset, memo }`
- Validation chain:
  1. Agent exists and belongs to requesting user
  2. Agent is not revoked
  3. `amount <= per_transaction_limit`
  4. `daily_spent + amount <= daily_limit`
  5. Agent wallet has sufficient balance
- Execute: sign and submit Stellar transaction
- Record: insert transaction row with tx hash, status, timestamp
- Update: increment `daily_spent` counter

### 5.4 Limit Reset
- Daily limit resets at UTC midnight
- Background job checks `last_reset_at` and resets `daily_spent = 0` if new day

### 5.5 Transaction Log
- List all transactions per agent or per user
- Fields: txHash, amount, asset, destination, memo, status, timestamp
- Link to `https://testnet.stellar.expert/explorer/testnet/tx/{hash}`

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Security | Agent secret keys AES-256 encrypted at rest |
| Security | No secret keys ever returned in API responses |
| Performance | API responses < 200ms (excluding Stellar network calls) |
| Reliability | Graceful handling of Horizon API errors |
| Observability | Structured console logging with request IDs |

---

## 7. Out of Scope (Phase 1)

- Approved merchant whitelists (Phase 2)
- Recurring/scheduled payments (Phase 2)
- x402 HTTP payment protocol (Phase 3)
- Soroban smart contract enforcement (Phase 4)
- Mainnet deployment (Phase 4)
- Multi-user agent sharing

---

## 8. Future Phases Summary

### Phase 2 — Advanced Controls
- Approved merchant (destination address) whitelist per agent
- Recurring allowances (weekly/monthly budget resets)
- Webhook notifications on payment events
- Email alerts on limit approach (80%/100% warnings)

### Phase 3 — x402 Agent SDK
- HTTP middleware for x402 v2 protocol compliance
- Agent SDK (TypeScript): drop-in payment handler for AI agent frameworks
- Integration examples: LangChain, OpenAI Assistants, AutoGPT

### Phase 4 — Soroban & Production
- Soroban smart contract: on-chain limit enforcement (trustless)
- Stellar Asset Contract integration for USDC
- Mainnet deployment with KMS key management
- Security audit
- Multi-tenant SaaS billing
