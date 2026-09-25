import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import {
  ForbiddenScreen,
  MaintenanceScreen,
  NetworkErrorScreen,
  NotFoundScreen,
  RateLimitedScreen,
  ServerErrorScreen,
  SessionExpiredScreen,
} from '@/components/system';
import { routing } from '@/i18n/routing';

const STATES = [
  'not-found',
  'forbidden',
  'server-error',
  'maintenance',
  'network-error',
  'session-expired',
  'rate-limited',
] as const;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => STATES.map((state) => ({ locale, state })));
}

interface SystemStatePageProps {
  params: { locale: string; state: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function SystemStatePage({ params: { locale, state }, searchParams }: SystemStatePageProps) {
  setRequestLocale(locale);
  const code = typeof searchParams.code === 'string' ? searchParams.code : undefined;

  switch (state) {
    case 'not-found':
      return <NotFoundScreen />;
    case 'forbidden':
      return <ForbiddenScreen code={code} />;
    case 'server-error':
      return <ServerErrorScreen />;
    case 'maintenance':
      return <MaintenanceScreen />;
    case 'network-error':
      return <NetworkErrorScreen />;
    case 'session-expired':
      return <SessionExpiredScreen />;
    case 'rate-limited':
      return <RateLimitedScreen />;
    default:
      notFound();
  }
}
