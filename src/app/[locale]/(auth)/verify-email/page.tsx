import { setRequestLocale } from 'next-intl/server';
import { VerifyEmailForm } from './VerifyEmailForm';

interface VerifyEmailPageProps {
  params: { locale: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export default function VerifyEmailPage({
  params: { locale },
  searchParams,
}: VerifyEmailPageProps) {
  setRequestLocale(locale);
  return (
    <VerifyEmailForm
      token={first(searchParams.token)}
      status={first(searchParams.status)}
      next={first(searchParams.next)}
    />
  );
}
