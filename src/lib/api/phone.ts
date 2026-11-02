/**
 * Algerian phone normalization shared by profile forms.
 * Accepts `0XXXXXXXXX`, `+213XXXXXXXXX`, `00213XXXXXXXXX`, ignoring
 * spaces/dashes/dots/parentheses. Stores canonical `+213XXXXXXXXX`.
 */
export const ALGERIAN_PHONE_PATTERN = /^\+213[2-7]\d{8}$/;

export function normalizeAlgerianPhone(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const compact = value.replace(/[\s\-.()]/g, '');
  if (compact === '') return null;
  let national: string;
  if (compact.startsWith('+213')) national = compact.slice(4);
  else if (compact.startsWith('00213')) national = compact.slice(5);
  else if (compact.startsWith('0')) national = compact.slice(1);
  else national = compact;
  if (!/^[2-7]\d{8}$/.test(national)) return null;
  return `+213${national}`;
}

export function isValidAlgerianPhone(value: string | null | undefined): boolean {
  return normalizeAlgerianPhone(value) !== null;
}
