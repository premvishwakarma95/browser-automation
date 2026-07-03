import type { Metadata } from 'next';
import Sidebar from './Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Alzato Admission Admin',
  description: 'Automated university application system — admin panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 px-10 py-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
