'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { api, Agent, Transaction } from '@/lib/api';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [balances, setBalances] = useState({ xlm: '0', usdc: '0' });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals/Forms
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [perTxLimit, setPerTxLimit] = useState(0);
  const [savingLimits, setSavingLimits] = useState(false);

  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payDest, setPayDest] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMemo, setPayMemo] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    try {
      const agentRes = await api.agents.get(id);
      setAgent(agentRes.agent);
      setBalances(agentRes.balances);
      setDailyLimit(agentRes.agent.dailyLimit);
      setPerTxLimit(agentRes.agent.perTxLimit);

      const txsRes = await api.payments.forAgent(id);
      setTransactions(txsRes.transactions);
    } catch (err) {
      console.error(err);
      router.push('/agents');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateLimits(e: React.FormEvent) {
    e.preventDefault();
    setSavingLimits(true);
    try {
      const res = await api.agents.updateLimits(id, { dailyLimit, perTxLimit });
      setAgent(res.agent);
      setShowLimitModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update limits');
    } finally {
      setSavingLimits(false);
    }
  }

  async function handleToggleRevoke() {
    if (!agent) return;
    setRevoking(true);
    try {
      if (agent.isRevoked) {
        await api.agents.restore(id);
      } else {
        await api.agents.revoke(id);
      }
      setShowRevokeModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setRevoking(false);
    }
  }

  async function handleSendPayment(e: React.FormEvent) {
    e.preventDefault();
    setPayError('');
    setPaying(true);

    try {
      await api.payments.send({
        agentId: id,
        destination: payDest,
        amount: payAmount,
        memo: payMemo,
      });

      setPayDest('');
      setPayAmount('');
      setPayMemo('');
      setShowPayModal(false);
      fetchData();
    } catch (err: any) {
      setPayError(err.message || 'Payment execution failed');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="loading-screen">
          <div className="spinner" style={{ width: 28, height: 28 }} />
          Loading agent details...
        </div>
      </AppLayout>
    );
  }

  if (!agent) return null;

  const usagePercent = agent.dailyLimit > 0 ? (agent.dailySpent / agent.dailyLimit) * 100 : 0;

  return (
    <AppLayout>
      <div className="page">
        {/* Header */}
        <div className="page-header flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title">{agent.name}</h1>
              <span className={`badge ${agent.isRevoked ? 'badge-revoked' : 'badge-active'}`}>
                {agent.isRevoked ? '🔴 Revoked' : '🟢 Active'}
              </span>
            </div>
            <p className="page-subtitle">{agent.description || 'No description provided'}</p>
          </div>
          <div className="flex gap-2">
            {!agent.isRevoked && (
              <button className="btn btn-primary" onClick={() => setShowPayModal(true)}>
                💸 Test Payment
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setShowLimitModal(true)}>
              ⚙ Configure Limits
            </button>
            <button
              className={`btn ${agent.isRevoked ? 'btn-success' : 'btn-danger'}`}
              onClick={() => setShowRevokeModal(true)}
            >
              {agent.isRevoked ? '🔓 Restore' : '🔒 Revoke Agent'}
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid-3 mb-6">
          {/* Stellar Account details */}
          <div className="card">
            <div className="card-title">Stellar Address</div>
            <div className="pubkey-display mb-4" style={{ padding: 8, fontSize: 10 }}>
              {agent.publicKey}
            </div>
            <div className="flex justify-between items-center text-secondary" style={{ fontSize: 12 }}>
              <span>Network: Testnet</span>
              <a
                href={`https://testnet.stellar.expert/explorer/testnet/account/${agent.publicKey}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)' }}
              >
                View in Explorer ↗
              </a>
            </div>
          </div>

          {/* Asset Balances */}
          <div className="card flex flex-col justify-between">
            <div>
              <div className="card-title">Agent Balances</div>
              <div className="flex flex-col gap-2">
                <div className="balance-chip" style={{ justifyContent: 'space-between' }}>
                  <span>{balances.usdc}</span>
                  <span className="symbol">USDC</span>
                </div>
                <div className="balance-chip" style={{ justifyContent: 'space-between' }}>
                  <span>{balances.xlm}</span>
                  <span className="symbol">XLM</span>
                </div>
              </div>
            </div>
            <div className="form-hint" style={{ marginTop: 8 }}>
              USDC is the default spending asset for this agent.
            </div>
          </div>

          {/* Budget / Spending limits stats */}
          <div className="card flex flex-col justify-between">
            <div>
              <div className="card-title">Policy Enforcement</div>
              <div className="spending-gauge mb-4">
                <div className="spending-gauge-label">
                  <span>Daily Spent</span>
                  <span>{agent.dailySpent.toFixed(2)} / {agent.dailyLimit} {agent.asset}</span>
                </div>
                <div className="spending-gauge-bar">
                  <div
                    className={`spending-gauge-fill ${
                      usagePercent > 80 ? 'gauge-danger' : usagePercent > 50 ? 'gauge-warn' : 'gauge-safe'
                    }`}
                    style={{ width: `${Math.min(100, usagePercent)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>Per-Tx Cap:</span>
              <strong>{agent.perTxLimit} {agent.asset}</strong>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Agent Execution Log</h2>
        {transactions.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No actions logged</div>
              <div className="empty-desc">This agent has not attempted any transaction executions yet.</div>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Destination</th>
                  <th>Amount</th>
                  <th>Memo</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Ledger Explorer</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className="mono truncate" title={tx.destination}>
                        {tx.destination.slice(0, 10)}...{tx.destination.slice(-10)}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: tx.status === 'success' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {tx.amount} {tx.asset}
                      </strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {tx.memo || <span style={{ color: 'var(--text-muted)' }}>none</span>}
                    </td>
                    <td>
                      <span className={`badge badge-${tx.status}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: tx.status === 'success' ? 'var(--text-secondary)' : 'var(--danger)' }}>
                      {tx.status === 'success' ? 'Settled on-chain' : tx.rejection_reason || 'Failed submission'}
                    </td>
                    <td>
                      {tx.explorer_url ? (
                        <a href={tx.explorer_url} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--accent)' }}>
                          Verify On-Chain ↗
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit Limits Modal */}
        {showLimitModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h2 className="modal-title">Configure Agent Limits</h2>
              <p className="modal-subtitle">Modify authorization rules for {agent.name}.</p>

              <form onSubmit={handleUpdateLimits}>
                <div className="form-group">
                  <label className="form-label">Daily Limit ({agent.asset})</label>
                  <input
                    type="number"
                    className="form-input"
                    value={dailyLimit}
                    onChange={e => setDailyLimit(Number(e.target.value))}
                    min="1"
                    required
                  />
                  <span className="form-hint">Maximum cumulative spending limit allowed per UTC day.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Per-Transaction Limit ({agent.asset})</label>
                  <input
                    type="number"
                    className="form-input"
                    value={perTxLimit}
                    onChange={e => setPerTxLimit(Number(e.target.value))}
                    min="1"
                    required
                  />
                  <span className="form-hint">Cap on any individual transaction amount.</span>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowLimitModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={savingLimits}>
                    {savingLimits ? 'Saving...' : 'Save Policy Rules'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Revoke Agent Modal */}
        {showRevokeModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h2 className="modal-title">{agent.isRevoked ? 'Restore Agent Wallet' : 'Revoke Agent Authorization'}</h2>
              <p className="modal-subtitle">
                {agent.isRevoked
                  ? 'This will re-authorize your AI agent to spend within the defined policy limits.'
                  : 'CRITICAL: Revoking authorization blocks all immediate API calls and payment requests. No secrets are deleted, but execution is disabled.'}
              </p>

              <div className={agent.isRevoked ? 'warning-box' : 'danger-box'} style={{ marginBottom: 16 }}>
                {agent.isRevoked
                  ? 'Agent wallet will resume testnet operations.'
                  : 'Any agent relying on this credential will receive a 403 Forbidden error upon attempting to execute a payment.'}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRevokeModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn ${agent.isRevoked ? 'btn-success' : 'btn-danger'}`}
                  disabled={revoking}
                  onClick={handleToggleRevoke}
                >
                  {revoking ? 'Processing...' : agent.isRevoked ? 'Restore Access' : 'Revoke Immediately'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Manual Payment Modal */}
        {showPayModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h2 className="modal-title">Trigger Manual Agent Payment</h2>
              <p className="modal-subtitle">Simulate a payment request originating from your agent.</p>

              {payError && <div className="form-error" style={{ marginBottom: 16 }}>{payError}</div>}

              <form onSubmit={handleSendPayment}>
                <div className="form-group">
                  <label className="form-label">Destination Stellar Public Key</label>
                  <input
                    type="text"
                    className="form-input mono"
                    placeholder="e.g. GBBD47..."
                    value={payDest}
                    onChange={e => setPayDest(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Amount ({agent.asset})</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    placeholder="0.00"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    required
                  />
                  <span className="form-hint">
                    Remaining today: {(agent.dailyLimit - agent.dailySpent).toFixed(2)} {agent.asset}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Memo (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Max 28 characters"
                    value={payMemo}
                    onChange={e => setPayMemo(e.target.value)}
                    maxLength={28}
                  />
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)} disabled={paying}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={paying}>
                    {paying ? <><span className="spinner" /> Executing...</> : 'Send Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
