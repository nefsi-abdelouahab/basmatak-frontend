import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card } from '@/components/ui/Card';

export default async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations('common');

  return (
    <Card>
      <div data-testid="home">
        <h1 className="mb-2 text-2xl font-bold text-ink">{t('home.title')}</h1>
        <p className="text-ink-muted">{t('home.description')}</p>
      </div>
    </Card>
  );
}
