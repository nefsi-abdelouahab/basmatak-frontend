'use client';

import { PublicTalentProfilePage } from '@/app/[locale]/(shared)/volunteers/[username]/PublicTalentProfilePage';
import { RequireOrg } from '../../profile/components';

// Organization-internal volunteer profile behind the Discover Talents profile
// action. Same profile content and design language as the public page, but
// rendered inside the authenticated Organization layout: the org sidebar and
// navigation stay mounted, guests are redirected to login via the existing
// decision-10 guard, and back navigation never leaves the org area. Data,
// gating, and copy all come from the reused public profile component and its
// hooks — nothing is duplicated here. No "Edit Profile" button: orgs don't own
// volunteer profiles (owner check stays volunteer-role, so it never matches
// an org session). No Save button either: the favorites backend only backs
// the volunteer role (@Roles('volunteer') on /favorites/talents/*), so an
// organization-role session would get 403 — omitted via allowSave={false}.
export function OrgVolunteerProfilePage({
  locale,
  username,
}: {
  locale: string;
  username: string;
}) {
  return (
    <RequireOrg locale={locale} next={`/org/volunteers/${username}`}>
      <PublicTalentProfilePage
        locale={locale}
        username={username}
        backHref="/org/discover-talents"
        loginNext={`/org/volunteers/${username}`}
        allowSave={false}
      />
    </RequireOrg>
  );
}
