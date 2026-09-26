import { setRequestLocale } from 'next-intl/server';
import { RegisterVolunteerForm } from './RegisterVolunteerForm';

export default function RegisterVolunteerPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <RegisterVolunteerForm />;
}
