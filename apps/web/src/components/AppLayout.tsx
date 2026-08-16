'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser, clearToken } from '@/lib/api';

const NAV = [
  { href: '/dashboard', icon: '⬛', label: 'Dashboard' },
  { href: '/agents', icon: '🤖', label: 'Agents' },
  { href: '/transactions', icon: '📋', label: 'Transactions' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.push('/login');
    } else {
      setUser(stored);
    }
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  if (!user) return null;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚡</div>
          <div className="sidebar-logo-text">
            Stellar<span>Pay</span>
          </div>
          <div className="network-badge" style={{ marginLeft: 'auto' }}>Test</div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(item => (
            <Link key={item.href} href={item.href}>
              <button
                className={`nav-item${pathname.startsWith(item.href) ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="user-email">{user.email}</div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
