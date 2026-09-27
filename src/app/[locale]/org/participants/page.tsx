import { setRequestLocale } from 'next-intl/server';
import { OrgParticipantsPage } from './OrgParticipantsPage';

interface ParticipantsPageProps {
  params: { locale: string };
}

export default function OrgParticipantsRoute({ params: { locale } }: ParticipantsPageProps) {
  setRequestLocale(locale);
  return <OrgParticipantsPage locale={locale} />;
}
