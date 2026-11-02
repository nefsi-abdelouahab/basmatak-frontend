/**
 * Shared label helpers for profile lookups. Lookup rows carry both locale
 * names; visible text must never fall back to a raw database id.
 */
export interface LocalizedRow {
  nameAr?: string | null;
  nameFr?: string | null;
  name?: string | null;
}

export function localizedName(
  row: LocalizedRow | null | undefined,
  locale: string,
): string {
  if (!row) return '';
  if (locale === 'ar') {
    return firstNonEmpty(row.nameAr, row.nameFr, row.name);
  }
  return firstNonEmpty(row.nameFr, row.nameAr, row.name);
}

export function localizedLocationName(
  row: LocalizedRow | null | undefined,
  locale: string,
): string {
  return localizedName(row, locale);
}

export function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return '';
}
