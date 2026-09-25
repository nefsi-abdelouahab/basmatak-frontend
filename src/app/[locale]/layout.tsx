import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Shell } from '@/components/shell/Shell';
import { isLocale, routing } from '@/i18n/routing';
import { QueryProvider } from '@/lib/query/provider';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-plex-arabic',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!isLocale(params.locale)) return {};
  const t = await getTranslations({ locale: params.locale, namespace: 'common' });
  return { title: t('appName') };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={`${inter.variable} ${plexArabic.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <Shell>{children}</Shell>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
