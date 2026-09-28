import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crates of Five · MP.8 Repeated Reasoning · Grade 3',
  description:
    'An interactive math story for Grade 3: build equal groups of 5, notice the repeated +5, connect it to groups × 5, and check a wrong guess.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d6fd6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
