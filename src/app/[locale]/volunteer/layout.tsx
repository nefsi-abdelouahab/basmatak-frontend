import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Shell } from '@/components/shell/Shell';

// Authenticated volunteer area keeps the 3-column shell.
export default function VolunteerLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <Shell>{children}</Shell>;
}
