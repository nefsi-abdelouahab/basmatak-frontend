'use client';

import { VolunteerTalentsPage } from '@/app/[locale]/volunteer/talents/VolunteerTalentsPage';
import { useOrgAccountQuery } from '@/hooks/useOrgAccount';
import { RequireOrg } from '../profile/components';

// Organization-internal Discover Talents behind the org sidebar entry. Same
// talent list/filters/facets content as the volunteer-space version (real
// GET /talents data, same icons, same empty/loading states), rendered inside
// the authenticated Organization layout: the org sidebar and navigation stay
// mounted, guests redirect to login via the existing decision-10 guard.
// Only the shell/route differ — talent cards link to the org profile route
// below, and the "Near" chip resolves from the org's own wilaya. No
// Save/Follow button here: the favorites backend only backs the volunteer
// role (verified @Roles('volunteer') on /favorites/talents/*), so an
// organization-role session cannot save — omitted, never fabricated.
export function OrgDiscoverTalentsPage({
  locale,
  initialSearch,
}: {
  locale: string;
  initialSearch: Record<string, string | string[] | undefined>;
}) {
  return (
    <RequireOrg locale={locale} next="/org/discover-talents">
      <OrgDiscoverTalentsContent locale={locale} initialSearch={initialSearch} />
    </RequireOrg>
  );
}

function OrgDiscoverTalentsContent({
  locale,
  initialSearch,
}: {
  locale: string;
  initialSearch: Record<string, string | string[] | undefined>;
}) {
  const accountQuery = useOrgAccountQuery();
  const wilayaId = accountQuery.data?.location?.wilayaId ?? null;
  return (
    <VolunteerTalentsPage
      locale={locale}
      initialSearch={initialSearch}
      profileBase="/org/volunteers"
      nearbyWilayaId={wilayaId}
    />
  );
}
