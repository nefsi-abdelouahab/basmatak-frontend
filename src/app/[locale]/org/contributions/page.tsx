import { setRequestLocale } from 'next-intl/server';
import { OrgContributionsPage } from './OrgContributionsPage';

interface ContributionsPageProps {
  params: { locale: string };
}

export default function OrgContributionsRoute({ params: { locale } }: ContributionsPageProps) {
  setRequestLocale(locale);
  return <OrgContributionsPage locale={locale} />;
}
