import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-muted">
      <Navbar />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        <Sidebar />
        <main data-testid="shell-main" className="min-w-0 flex-1 pb-16 lg:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
