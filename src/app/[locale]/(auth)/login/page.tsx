import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from './LoginForm';

interface LoginPageProps {
  params: { locale: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function LoginPage({ params: { locale }, searchParams }: LoginPageProps) {
  setRequestLocale(locale);
  const raw = searchParams.next;
  const next = typeof raw === 'string' ? raw : undefined;
  return <LoginForm next={next} />;
}
