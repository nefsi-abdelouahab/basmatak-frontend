import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Shell } from '@/components/shell/Shell';

// Authenticated admin area keeps the 3-column shell.
export default function AdminLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <Shell>{children}</Shell>;
}
