import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sphere Puzzle — UCT Testnet',
  description: 'Sphere-connected 2048 puzzle on Unicity testnet2.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
