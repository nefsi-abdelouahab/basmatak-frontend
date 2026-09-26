import { getRequestConfig } from 'next-intl/server';
import { routing, isLocale } from './routing';
import authAr from '../messages/auth/ar.json';
import authEn from '../messages/auth/en.json';
import commonAr from '../messages/common/ar.json';
import commonEn from '../messages/common/en.json';
import opportunityDetailsAr from '../messages/opportunityDetails/ar.json';
import opportunityDetailsEn from '../messages/opportunityDetails/en.json';
import orgOnboardingAr from '../messages/orgOnboarding/ar.json';
import orgOnboardingEn from '../messages/orgOnboarding/en.json';
import systemAr from '../messages/system/ar.json';
import systemEn from '../messages/system/en.json';
import submitContributionAr from '../messages/submit-contribution/ar.json';
import submitContributionEn from '../messages/submit-contribution/en.json';
import volunteerAccountAr from '../messages/volunteer-account/ar.json';
import volunteerAccountEn from '../messages/volunteer-account/en.json';
import volunteerHomeAr from '../messages/volunteer-home/ar.json';
import volunteerHomeEn from '../messages/volunteer-home/en.json';
import volunteerTasksAr from '../messages/volunteer-tasks/ar.json';
import volunteerCredentialsAr from '../messages/volunteer-credentials/ar.json';
import volunteerTasksEn from '../messages/volunteer-tasks/en.json';
import volunteerCredentialsEn from '../messages/volunteer-credentials/en.json';

// Owner decision: per-area catalogs merged here — never a single global pair.
// Each session owns its messages/<area>/ pair; this file only merges.
// F1: added the auth area (approved additive edit; no existing area changed).
// F2: added the volunteer-account area (approved additive edit).
// F3: added the orgOnboarding area (same additive pattern; nothing changed).
// F4: added the volunteer-home area (same additive pattern; nothing changed).
// F5: added the opportunityDetails area (same additive pattern; nothing changed).
// F6: added the volunteer-tasks area (same additive pattern; nothing changed).
// F7: added the submit-contribution area (same additive pattern; nothing changed).
// F8: added the volunteer-credentials area (same additive pattern; nothing changed).
const catalogs = {
  en: { common: commonEn, system: systemEn, auth: authEn, volunteerAccount: volunteerAccountEn, orgOnboarding: orgOnboardingEn, opportunityDetails: opportunityDetailsEn, submitContribution: submitContributionEn, volunteerHome: volunteerHomeEn, volunteerTasks: volunteerTasksEn, volunteerCredentials: volunteerCredentialsEn },
  ar: { common: commonAr, system: systemAr, auth: authAr, volunteerAccount: volunteerAccountAr, orgOnboarding: orgOnboardingAr, opportunityDetails: opportunityDetailsAr, submitContribution: submitContributionAr, volunteerHome: volunteerHomeAr, volunteerTasks: volunteerTasksAr, volunteerCredentials: volunteerCredentialsAr },
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
