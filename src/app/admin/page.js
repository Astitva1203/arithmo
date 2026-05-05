'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { resilientFetch } from '@/lib/resilientFetch';

function MetricCard({ label, value }) {
  return (
    <div className="admin-card">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resilientFetch('/api/admin/stats')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Failed to load admin stats.');
        setStats(data);
      })
      .catch((err) => setError(err.message || 'Admin access required.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <div className="admin-header">
          <div>
            <p>Arithmo AI</p>
            <h1>Admin Monitoring</h1>
          </div>
          <Link href="/">Back to Chat</Link>
        </div>

        {loading && <div className="admin-notice">Loading operational stats...</div>}
        {error && <div className="admin-error">{error}</div>}

        {stats && (
          <>
            <div className="admin-grid">
              <MetricCard label="Total Users" value={stats.users.total} />
              <MetricCard label="Active 24h" value={stats.users.activeToday} />
              <MetricCard label="Active 7d" value={stats.users.activeWeek} />
              <MetricCard label="Free Users" value={stats.users.free} />
              <MetricCard label="Pro Users" value={stats.users.pro} />
              <MetricCard label="Lifetime Users" value={stats.users.lifetime} />
              <MetricCard label="Chat Today" value={stats.usage.chat} />
              <MetricCard label="Search Today" value={stats.usage.search} />
              <MetricCard label="Research Today" value={stats.usage.research} />
              <MetricCard label="Images Today" value={stats.usage.images} />
              <MetricCard label="Rate Limits 24h" value={stats.security.rateLimitHits} />
            </div>

            <section className="admin-panel">
              <h2>Recent Server Issues</h2>
              {stats.security.recentErrors?.length ? (
                <div className="admin-log-list">
                  {stats.security.recentErrors.map((item, index) => (
                    <article key={`${item.createdAt}-${index}`}>
                      <strong>{item.type}</strong>
                      <span>{item.message || 'No message'}</span>
                      <small>{item.email || 'system'} | {new Date(item.createdAt).toLocaleString()}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No recent server errors logged.</p>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
