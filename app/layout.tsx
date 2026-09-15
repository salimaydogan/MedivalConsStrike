import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'MedivalConsStrike — Atlı Keşif',
  description:
    'Orta Çağ kalesinde üçüncü şahıs hareket ve at sürüşü prototipi.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MedivalConsStrike',
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
