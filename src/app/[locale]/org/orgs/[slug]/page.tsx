import { setRequestLocale } from 'next-intl/server';
import { OrgOrgProfilePage } from './OrgOrgProfilePage';

interface OrgOrgProfileRouteProps {
  params: { locale: string; slug: string };
}

export default function OrgOrgProfileRoute({
  params: { locale, slug },
}: OrgOrgProfileRouteProps) {
  setRequestLocale(locale);
  return <OrgOrgProfilePage locale={locale} slug={slug} />;
}
