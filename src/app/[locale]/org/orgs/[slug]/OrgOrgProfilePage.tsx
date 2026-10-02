'use client';

import { PublicOrgProfilePage } from '@/app/[locale]/(shared)/orgs/[slug]/PublicOrgProfilePage';
import { RequireOrg } from '../../profile/components';

// Organization-internal organization profile (viewing another organization's
// public profile from within the org workspace). Same content as the existing
// Public Organization Profile, wrapped in the org Shell instead of the public
// navbar/footer: the org sidebar and navigation stay mounted, guests redirect
// to login via the existing decision-10 guard. Data, gating, and copy all come
// from the reused public profile component and its hooks — nothing is
// duplicated here. Save/Follow is omitted: no organization-follows-organization
// endpoint exists (favorites back only opportunity + talent targets), so no
// button is fabricated. Own-profile edit is covered by the reused component's
// owner branch: when the viewing org owns this slug it shows Manage →
// /org/profile, the real edit form wired to PATCH /organizations/me.
export function OrgOrgProfilePage({ locale, slug }: { locale: string; slug: string }) {
  return (
    <RequireOrg locale={locale} next={`/org/orgs/${slug}`}>
      <PublicOrgProfilePage locale={locale} slug={slug} />
    </RequireOrg>
  );
}
