import { setRequestLocale } from 'next-intl/server';
import { PublicOrgProfilePage } from './PublicOrgProfilePage';

interface PublicOrgProfileRouteProps {
  params: { locale: string; slug: string };
}

export default function PublicOrgProfileRoute({
  params: { locale, slug },
}: PublicOrgProfileRouteProps) {
  setRequestLocale(locale);
  return <PublicOrgProfilePage locale={locale} slug={slug} />;
}
