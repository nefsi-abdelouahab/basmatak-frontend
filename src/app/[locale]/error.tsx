'use client';

import { ServerErrorScreen } from '@/components/system/ServerErrorScreen';

export default function LocaleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ServerErrorScreen onRetry={reset} />;
}
