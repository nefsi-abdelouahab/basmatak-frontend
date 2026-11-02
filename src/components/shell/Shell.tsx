import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { BottomNav } from './BottomNav';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <Container className="flex flex-1 gap-6 py-6">
        <Sidebar />
        <main data-testid="shell-main" className="min-w-0 flex-1 pb-16 lg:pb-0">
          {children}
        </main>
      </Container>
      <BottomNav />
    </div>
  );
}
