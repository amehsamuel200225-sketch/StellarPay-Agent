'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { api, Transaction } from '@/lib/api';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const LIMIT = 25;

  useEffect(() => {
    fetchTransactions();
  }, [offset]);

  async function fetchTransactions() {
    setLoading(true);
    try {
      const res = await api.payments.list(LIMIT, offset);
      setTransactions(res.transactions);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Transaction Ledger</h1>
          <p className="page-subtitle">Historical log of all execution attempts and payments across your agents</p>
        </div>

        {loading && transactions.length === 0 ? (
          <div className="loading-screen">
            <div className="spinner" style={{ width: 28, height: 28 }} />
            Loading transaction ledger...
          </div>
        ) : transactions.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No transactions logged</div>
              <div className="empty-desc">When your agents execute payments or get rejected by limits, logs will display here.</div>
            </div>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Agent</th>
                    <th>Recipient</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Memo</th>
                    <th>Details</th>
                    <th>Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 500 }}>{tx.agent_name || 'Deleted Agent'}</td>
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
                      <td>
                        <span className={`badge badge-${tx.status}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {tx.memo || <span style={{ color: 'var(--text-muted)' }}>none</span>}
                      </td>
                      <td style={{ fontSize: 12, color: tx.status === 'success' ? 'var(--text-secondary)' : 'var(--danger)' }}>
                        {tx.status === 'success' ? 'Settled' : tx.rejection_reason || 'Failed'}
                      </td>
                      <td>
                        {tx.explorer_url ? (
                          <a href={tx.explorer_url} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--accent)' }}>
                            View Tx ↗
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > LIMIT && (
              <div className="flex justify-between items-center mt-4">
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Showing {offset + 1} - {Math.min(offset + LIMIT, total)} of {total} transactions
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                    disabled={offset === 0}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setOffset(offset + LIMIT)}
                    disabled={offset + LIMIT >= total}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
