import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StellarPay Agent — Programmable AI Payments on Stellar',
  description: 'Permission-based payment infrastructure for AI agents. Set spending limits, approve merchants, and track every transaction on Stellar.',
  keywords: 'Stellar, USDC, AI agents, payments, x402, blockchain',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
