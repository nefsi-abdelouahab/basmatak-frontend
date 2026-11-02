'use client';

import { OrganizationProfileForm } from '@/components/profile/OrganizationProfileForm';

/**
 * Backwards-compatible route-local export. The factsheet UI is now the shared
 * organization profile form used by both `org/profile` and
 * `org/complete-profile`.
 */
export function FactsheetSection() {
  return <OrganizationProfileForm />;
}
