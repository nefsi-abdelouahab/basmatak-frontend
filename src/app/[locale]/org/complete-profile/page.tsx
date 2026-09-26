import { setRequestLocale } from 'next-intl/server';
import { CompleteProfileForm } from './CompleteProfileForm';

export default function CompleteProfilePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <CompleteProfileForm />;
}
