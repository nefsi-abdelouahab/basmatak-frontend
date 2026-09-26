import { setRequestLocale } from 'next-intl/server';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export default function ForgotPasswordPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <ForgotPasswordForm />;
}
