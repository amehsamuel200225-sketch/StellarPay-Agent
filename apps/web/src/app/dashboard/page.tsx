'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { api, Agent, Transaction } from '@/lib/api';

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.agents.list(), api.payments.list(5)])
      .then(([agentsRes, txRes]) => {
        setAgents(agentsRes.agents);
        setTransactions(txRes.transactions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const activeAgents = agents.filter(a => !a.isRevoked);
  const totalSpentToday = agents.reduce((sum, a) => sum + a.dailySpent, 0);
  const successTxCount = transactions.filter(t => t.status === 'success').length;

  return (
    <AppLayout>
      <div className="page">
        <div className="page-header flex justify-between items-center">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Overview of your AI agent payment activity</p>
          </div>
          <Link href="/agents">
            <button className="btn btn-primary">+ New Agent</button>
          </Link>
        </div>

        {loading ? (
          <div className="loading-screen">
            <div className="spinner" style={{ width: 28, height: 28 }} />
            Loading your dashboard...
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="stats-grid">
              <div className="card">
                <div className="card-title">Active Agents</div>
                <div className="card-value">{activeAgents.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {agents.length - activeAgents.length} revoked
                </div>
              </div>
              <div className="card">
                <div className="card-title">Spent Today</div>
                <div className="card-value" style={{ color: 'var(--accent)' }}>
                  ${totalSpentToday.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>across all agents</div>
              </div>
              <div className="card">
                <div className="card-title">Recent Transactions</div>
                <div className="card-value">{successTxCount}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>successful payments</div>
              </div>
              <div className="card">
                <div className="card-title">Network</div>
                <div style={{ marginTop: 6 }}>
                  <span className="network-badge">⚠ Stellar Testnet</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>no real funds</div>
              </div>
            </div>

            {/* Agents Summary */}
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Your Agents</h2>
              <Link href="/agents" style={{ fontSize: 13, color: 'var(--accent)' }}>View all →</Link>
            </div>

            {agents.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-icon">🤖</div>
                  <div className="empty-title">No agents yet</div>
                  <div className="empty-desc">Create your first AI agent wallet to get started.</div>
                  <Link href="/agents" style={{ marginTop: 16 }}>
                    <button className="btn btn-primary">Create agent</button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid-2 mb-6">
                {agents.slice(0, 4).map(agent => (
                  <Link key={agent.id} href={`/agents/${agent.id}`}>
                    <div className="agent-card">
                      <div className="agent-card-header">
                        <div>
                          <div className="agent-card-name">{agent.name}</div>
                          <div className="agent-card-desc">{agent.description || agent.publicKey.slice(0, 20) + '...'}</div>
                        </div>
                        <span className={`badge ${agent.isRevoked ? 'badge-revoked' : 'badge-active'}`}>
                          {agent.isRevoked ? '🔴 Revoked' : '🟢 Active'}
                        </span>
                      </div>
                      <div className="spending-gauge">
                        <div className="spending-gauge-label">
                          <span>Spent today</span>
                          <span>${agent.dailySpent.toFixed(2)} / ${agent.dailyLimit}</span>
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
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Recent Transactions */}
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recent Transactions</h2>
              <Link href="/transactions" style={{ fontSize: 13, color: 'var(--accent)' }}>View all →</Link>
            </div>

            {transactions.length === 0 ? (
              <div className="card">
                <div className="empty-state" style={{ padding: '32px 20px' }}>
                  <div className="empty-icon">📋</div>
                  <div className="empty-title">No transactions yet</div>
                  <div className="empty-desc">Payments made by your agents will appear here.</div>
                </div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Destination</th>
                      <th>Time</th>
                      <th>Explorer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ fontWeight: 500 }}>{tx.agent_name || '—'}</td>
                        <td>
                          <strong>{tx.amount} {tx.asset}</strong>
                        </td>
                        <td>
                          <span className={`badge badge-${tx.status}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td>
                          <span className="mono truncate">{tx.destination.slice(0, 12)}...</span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                          {new Date(tx.created_at).toLocaleTimeString()}
                        </td>
                        <td>
                          {tx.explorer_url ? (
                            <a href={tx.explorer_url} target="_blank" rel="noopener noreferrer"
                              style={{ color: 'var(--accent)', fontSize: 13 }}>↗ View</a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
