'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api, Agent } from '@/lib/api';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dailyLimit, setDailyLimit] = useState(20);
  const [perTxLimit, setPerTxLimit] = useState(5);
  const [asset, setAsset] = useState('USDC');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      const res = await api.agents.list();
      setAgents(res.agents);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setCreating(true);

    try {
      await api.agents.create({
        name,
        description,
        dailyLimit,
        perTxLimit,
        asset
      });
      setName('');
      setDescription('');
      setDailyLimit(20);
      setPerTxLimit(5);
      setAsset('USDC');
      setShowModal(false);
      fetchAgents();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppLayout>
      <div className="page">
        <div className="page-header flex justify-between items-center">
          <div>
            <h1 className="page-title">AI Agents</h1>
            <p className="page-subtitle">Manage agent wallets and authorization parameters</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Create Agent
          </button>
        </div>

        {loading ? (
          <div className="loading-screen">
            <div className="spinner" style={{ width: 28, height: 28 }} />
            Loading agents...
          </div>
        ) : agents.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">🤖</div>
              <div className="empty-title">No agents configured</div>
              <div className="empty-desc">Create a new agent to provision its Stellar wallet and define spending limits.</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
                Create agent
              </button>
            </div>
          </div>
        ) : (
          <div className="grid-2">
            {agents.map(agent => (
              <Link key={agent.id} href={`/agents/${agent.id}`}>
                <div className="agent-card">
                  <div className="agent-card-header">
                    <div>
                      <div className="agent-card-name">{agent.name}</div>
                      <div className="agent-card-desc">{agent.description || 'No description'}</div>
                    </div>
                    <span className={`badge ${agent.isRevoked ? 'badge-revoked' : 'badge-active'}`}>
                      {agent.isRevoked ? '🔴 Revoked' : '🟢 Active'}
                    </span>
                  </div>

                  <div className="spending-gauge" style={{ marginTop: 8 }}>
                    <div className="spending-gauge-label">
                      <span>Spent today</span>
                      <span>{agent.dailySpent.toFixed(2)} / {agent.dailyLimit} {agent.asset}</span>
                    </div>
                    <div className="spending-gauge-bar">
                      <div
                        className={`spending-gauge-fill ${
                          (agent.dailySpent / agent.dailyLimit) > 0.8 ? 'gauge-danger' :
                          (agent.dailySpent / agent.dailyLimit) > 0.5 ? 'gauge-warn' : 'gauge-safe'
                        }`}
                        style={{ width: `${Math.min(100, (agent.dailySpent / agent.dailyLimit) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="balance-row" style={{ marginTop: 4 }}>
                    <div className="balance-chip">
                      <span className="symbol">Stellar address:</span>
                      <span className="mono">{agent.publicKey.slice(0, 6)}...{agent.publicKey.slice(-6)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create Agent Modal */}
        {showModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h2 className="modal-title">Create AI Agent</h2>
              <p className="modal-subtitle">Provision a secure testnet wallet and set limits for the agent.</p>

              {formError && <div className="form-error" style={{ marginBottom: 16 }}>{formError}</div>}

              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. DataScraper Agent"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="What will this agent pay for?"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Daily Limit</label>
                    <input
                      type="number"
                      className="form-input"
                      value={dailyLimit}
                      onChange={e => setDailyLimit(Number(e.target.value))}
                      min="1"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Per-Tx Limit</label>
                    <input
                      type="number"
                      className="form-input"
                      value={perTxLimit}
                      onChange={e => setPerTxLimit(Number(e.target.value))}
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Asset</label>
                  <select
                    className="form-input"
                    value={asset}
                    onChange={e => setAsset(e.target.value)}
                  >
                    <option value="USDC">USDC (Stablecoin)</option>
                    <option value="XLM">XLM (Stellar Lumens)</option>
                  </select>
                </div>

                <div className="warning-box" style={{ marginBottom: 16 }}>
                  💡 Creating this agent will automatically hit Friendbot to fund its account with XLM, and establish a USDC trustline if USDC is selected.
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? <><span className="spinner" /> Provisioning...</> : 'Create & Fund'}
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
