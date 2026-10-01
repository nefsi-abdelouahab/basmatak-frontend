import { setRequestLocale } from 'next-intl/server';
import { ResetPasswordForm } from './ResetPasswordForm';

interface ResetPasswordPageProps {
  params: { locale: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ResetPasswordPage({
  params: { locale },
  searchParams,
}: ResetPasswordPageProps) {
  setRequestLocale(locale);
  const raw = searchParams.token;
  const token = typeof raw === 'string' ? raw : undefined;
  // Guest-only enforcement lives in the (auth) layout.
  return <ResetPasswordForm token={token} />;
}
