import { setRequestLocale } from 'next-intl/server';
import { RegisterOrganizationForm } from './RegisterOrganizationForm';

export default function RegisterOrganizationPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <RegisterOrganizationForm />;
}
