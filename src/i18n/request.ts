import { getRequestConfig } from 'next-intl/server';
import { routing, isLocale } from './routing';
import commonAr from '../messages/common/ar.json';
import commonEn from '../messages/common/en.json';
import systemAr from '../messages/system/ar.json';
import systemEn from '../messages/system/en.json';

// Owner decision: per-area catalogs merged here — never a single global pair.
// Each session owns its messages/<area>/ pair; this file only merges.
const catalogs = {
  en: { common: commonEn, system: systemEn },
  ar: { common: commonAr, system: systemAr },
} as const;

export type MessageArea = keyof (typeof catalogs)['en'];

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: catalogs[locale],
  };
});
