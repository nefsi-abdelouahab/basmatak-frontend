import { setRequestLocale } from 'next-intl/server';
import { RequireGuest } from '@/components/guards/RequireGuest';
import { CreateAccountForm } from './CreateAccountForm';

interface CreateAccountPageProps {
  params: { locale: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function CreateAccountPage({ params: { locale }, searchParams }: CreateAccountPageProps) {
  setRequestLocale(locale);
  const raw = searchParams.type;
  const initialType = raw === 'organization' ? 'organization' : 'volunteer';
  // Guest-only: authenticated visits bounce to the role home.
  return (
    <RequireGuest>
      <CreateAccountForm initialType={initialType} />
    </RequireGuest>
  );
}
