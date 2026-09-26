import { setRequestLocale } from 'next-intl/server';
import { VerificationDossierForm } from './VerificationDossierForm';

export default function VerificationDossierPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <VerificationDossierForm />;
}
