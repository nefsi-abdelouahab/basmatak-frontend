import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';

export default async function CreateAccountPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <Card className="mx-auto w-full max-w-md">
      <div data-testid="auth-create-account" className="flex flex-col gap-4">
        <h1 className="mb-1 text-2xl font-bold text-ink">{t('createAccount.title')}</h1>
        <p className="text-ink-muted">{t('createAccount.subtitle')}</p>
        <section className="rounded-md border border-border bg-surface-muted p-4">
          <h2 className="text-lg font-semibold text-ink">{t('createAccount.volunteerTitle')}</h2>
          <p className="mb-3 text-sm text-ink-muted">
            {t('createAccount.volunteerDescription')}
          </p>
          <Link
            href="/register-volunteer"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            {t('createAccount.volunteerCta')}
          </Link>
        </section>
        <section className="rounded-md border border-border bg-surface-muted p-4">
          <h2 className="text-lg font-semibold text-ink">{t('createAccount.orgTitle')}</h2>
          <p className="mb-3 text-sm text-ink-muted">{t('createAccount.orgDescription')}</p>
          <Link
            href="/register-organization"
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            {t('createAccount.orgCta')}
          </Link>
        </section>
        <p className="text-sm text-ink-muted">
          {t('createAccount.haveAccount')}{' '}
          <Link href="/login" className="font-medium text-primary">
            {t('createAccount.signIn')}
          </Link>
        </p>
      </div>
    </Card>
  );
}
