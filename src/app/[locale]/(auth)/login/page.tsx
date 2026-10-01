import { setRequestLocale } from 'next-intl/server';
import { RequireGuest } from '@/components/guards/RequireGuest';
import { LoginForm } from './LoginForm';

interface LoginPageProps {
  params: { locale: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function LoginPage({ params: { locale }, searchParams }: LoginPageProps) {
  setRequestLocale(locale);
  const raw = searchParams.next;
  const next = typeof raw === 'string' ? raw : undefined;
  const statusRaw = searchParams.status;
  const status = typeof statusRaw === 'string' ? statusRaw : undefined;
  // Guest-only: authenticated visits bounce to the role home (verify-email
  // stays shared — it serves authenticated-but-unverified users too).
  return (
    <RequireGuest>
      <LoginForm next={next} status={status} />
    </RequireGuest>
  );
}
