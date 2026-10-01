import { setRequestLocale } from 'next-intl/server';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export default function ForgotPasswordPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  // Guest-only enforcement lives in the (auth) layout.
  return <ForgotPasswordForm />;
}
