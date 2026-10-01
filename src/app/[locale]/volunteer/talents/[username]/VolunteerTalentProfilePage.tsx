'use client';

import { PublicTalentProfilePage } from '@/app/[locale]/(shared)/volunteers/[username]/PublicTalentProfilePage';
import { RequireVolunteer } from '../../components';

// Volunteer-internal talent profile behind the Discover Talents profile
// action. Same profile content and design language as the public page, but
// rendered inside the authenticated Volunteer layout: the Volunteer sidebar
// and navigation stay mounted, guests are redirected to login via the
// existing decision-10 guard, and back navigation never leaves the
// Volunteer area. Data, gating, and copy all come from the reused public
// profile component and its hooks — nothing is duplicated here.
export function VolunteerTalentProfilePage({
  locale,
  username,
}: {
  locale: string;
  username: string;
}) {
  return (
    <RequireVolunteer locale={locale} next={`/volunteer/talents/${username}`}>
      <PublicTalentProfilePage
        locale={locale}
        username={username}
        backHref="/volunteer/talents"
        loginNext={`/volunteer/talents/${username}`}
      />
    </RequireVolunteer>
  );
}
