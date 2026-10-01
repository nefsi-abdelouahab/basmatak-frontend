import { setRequestLocale } from 'next-intl/server';
import { RequireGuest } from '@/components/guards/RequireGuest';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export default function ForgotPasswordPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  // Guest-only: authenticated visits bounce to the role home.
  return (
    <RequireGuest>
      <ForgotPasswordForm />
    </RequireGuest>
  );
}
