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
  return <ResetPasswordForm token={token} />;
}
