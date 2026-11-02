import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Inter, Tajawal } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { isLocale, routing } from '@/i18n/routing';
import { QueryProvider } from '@/lib/query/provider';
import { AiAgentErrorBoundary } from '@/components/ai-agent/AiAgentErrorBoundary';
import { AiAgentWidget } from '@/components/ai-agent/AiAgentWidget';
import { AppToaster } from '@/components/ui/AppToaster';
import { themeInitScript } from '@/theme/theme';
import '../globals.css';

// Font variables back the Tailwind sans stack. Inter serves en/fr; Tajawal is
// applied only for ar. Literal face names ride along in globals.css so the
// computed stack always names the face.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '700', '800'],
  variable: '--font-tajawal',
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
  const isArabic = locale === 'ar';

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={isArabic ? tajawal.variable : inter.variable}
      suppressHydrationWarning
    >
      <body className={isArabic ? 'font-arabic' : 'font-sans'}>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            {children}
            <AiAgentErrorBoundary>
              <AiAgentWidget />
            </AiAgentErrorBoundary>
            <AppToaster />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
