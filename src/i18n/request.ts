import { getRequestConfig } from 'next-intl/server';
import { routing, isLocale } from './routing';

// Owner decision: per-area catalogs auto-discovered — never a single global
// pair, and no per-session edits to this file. Each session owns its
// messages/<area>/ pair; the loader below merges every
// messages/*/{en,ar}.json found at build time (webpack require.context —
// static analysis, identical in dev and build, server runtime only). The area
// key derives from the directory name (kebab-to-camelCase, so
// `volunteer-account` serves as `volunteerAccount`). Shipping the two locale
// files is sufficient for both locales; an unpaired file throws at startup
// instead of serving silently missing strings.

type SupportedLocale = 'en' | 'ar';

// JSON message files: nested string maps (mirrors use-intl AbstractIntlMessages).
interface CatalogMessages {
  [key: string]: string | CatalogMessages;
}

interface WebpackRequireContext {
  (id: string): unknown;
  keys(): string[];
}

interface WebpackRequire {
  context: (
    directory: string,
    useSubdirectories: boolean,
    filter: RegExp,
  ) => WebpackRequireContext;
}

function toAreaKey(directory: string): string {
  return directory.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

const messagesContext = (require as unknown as WebpackRequire).context(
  '../messages',
  true,
  /\.json$/,
);

function areaNames(locale: SupportedLocale): Set<string> {
  const areas = new Set<string>();
  for (const key of messagesContext.keys()) {
    const match = /^\.\/([^/]+)\/(en|ar)\.json$/.exec(key);
    if (match && match[2] === locale && match[1]) areas.add(match[1]);
  }
  return areas;
}

function loadCatalog(locale: SupportedLocale): CatalogMessages {
  const catalog: CatalogMessages = {};
  for (const key of messagesContext.keys().sort()) {
    const match = /^\.\/([^/]+)\/(en|ar)\.json$/.exec(key);
    if (!match || match[2] !== locale || !match[1]) continue;
    catalog[toAreaKey(match[1])] = messagesContext(key) as CatalogMessages;
  }
  return catalog;
}

// Fail fast on unpaired locale files (build time + server startup).
const enAreas = areaNames('en');
const arAreas = areaNames('ar');
for (const area of enAreas) {
  if (!arAreas.has(area)) {
    throw new Error(`[i18n] messages/${area}/ar.json is missing (en.json has no Arabic pair)`);
  }
}
for (const area of arAreas) {
  if (!enAreas.has(area)) {
    throw new Error(`[i18n] messages/${area}/en.json is missing (ar.json has no English pair)`);
  }
}

const catalogs: Record<SupportedLocale, CatalogMessages> = {
  en: loadCatalog('en'),
  ar: loadCatalog('ar'),
};

export type MessageArea = string;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: catalogs[locale],
  };
});
