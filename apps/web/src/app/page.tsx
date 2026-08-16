'use client';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="landing">
      <div className="landing-badge">
        <span>⚡</span> Built on Stellar Testnet
      </div>

      <h1 className="landing-title">
        Programmable payments<br />
        for <span className="highlight">AI agents</span>
      </h1>

      <p className="landing-desc">
        Give your AI agent a spending allowance. It pays APIs, data providers and services automatically — every transaction recorded on-chain. You stay in control.
      </p>

      <div className="landing-actions">
        <Link href="/register">
          <button className="btn btn-primary btn-lg">Get started free →</button>
        </Link>
        <Link href="/login">
          <button className="btn btn-secondary btn-lg">Sign in</button>
        </Link>
      </div>

      <div className="landing-features">
        <div className="feature-card">
          <div className="feature-icon">💳</div>
          <div className="feature-title">Spending Limits</div>
          <div className="feature-desc">Daily caps and per-transaction limits enforced before every payment.</div>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🔐</div>
          <div className="feature-title">Instant Revocation</div>
          <div className="feature-desc">Freeze your agent's wallet with a single click. Effective immediately.</div>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🔗</div>
          <div className="feature-title">On-Chain Proof</div>
          <div className="feature-desc">Every transaction recorded on Stellar with an Explorer link.</div>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🤖</div>
          <div className="feature-title">Agent-Ready API</div>
          <div className="feature-desc">Simple REST API your AI agent calls to make payments.</div>
        </div>
      </div>

      <div style={{ marginTop: 48, fontSize: 13, color: 'var(--text-muted)' }}>
        <span className="network-badge">⚠ Testnet</span>
        &nbsp; All transactions use Stellar Testnet — no real funds.
      </div>
    </main>
  );
}
