import { mapToApiError } from '@/lib/api/errors';

// Every toast string lives in messages/toast/{en,ar}.json. This module is the
// only place that turns an unknown failure into one of those keys; server
// message text is never surfaced.

export type ToastErrorKey = `error.${string}`;
export type ToastMessageKey = `success.${string}` | ToastErrorKey;

// Backend business codes that deserve a precise, calm message. One table only
// (reused by the toast mapper); unknown codes fall through to status mapping.
export const BUSINESS_ERROR_KEYS: Readonly<Record<string, ToastErrorKey>> = {
  PUBLISH_GATE_LOCKED: 'error.publishGateLocked',
  PUBLISHING_DISABLED: 'error.publishingDisabled',
  ORG_NOT_VERIFIED: 'error.orgNotVerified',
  DUPLICATE_APPLICATION: 'error.duplicateApplication',
  SUBMISSION_ALREADY_EXISTS: 'error.submissionExists',
  INVALID_CREDENTIALS: 'error.invalidCredentials',
  EMAIL_NOT_VERIFIED: 'error.emailNotVerified',
  ACCOUNT_SUSPENDED: 'error.accountSuspended',
  ACCOUNT_INACCESSIBLE: 'error.accountInaccessible',
  EMAIL_ALREADY_REGISTERED: 'error.emailRegistered',
  PHONE_ALREADY_USED: 'error.phoneUsed',
  REGISTRATION_DISABLED: 'error.registrationDisabled',
  INVALID_RESET_TOKEN: 'error.invalidResetToken',
  INVALID_VERIFICATION_TOKEN: 'error.invalidVerificationToken',
  WRONG_PASSWORD: 'error.wrongPassword',
  SKILL_ALREADY_ADDED: 'error.skillAlreadyAdded',
  POSITION_FULL: 'error.positionFull',
  APPLICATION_DEADLINE_PASSED: 'error.deadlinePassed',
  APPLICATIONS_CLOSED: 'error.applicationsClosed',
  CONSENT_REQUIRED: 'error.consentRequired',
  EVIDENCE_REQUIRED: 'error.evidenceRequired',
  DESCRIPTION_REQUIRED: 'error.descriptionRequired',
  MEDIA_TYPE_NOT_ALLOWED: 'error.mediaTypeNotAllowed',
  LINK_HOST_NOT_ALLOWED: 'error.linkHostNotAllowed',
  OPPORTUNITY_FIELD_LOCKED: 'error.opportunityFieldLocked',
  OPPORTUNITY_NOT_DRAFT: 'error.opportunityNotDraft',
  OPPORTUNITY_HAS_ACCEPTED_PARTICIPANTS: 'error.opportunityHasAccepted',
  POSITION_NOT_DELETABLE: 'error.positionNotDeletable',
  REVIEW_ALREADY_EXISTS: 'error.reviewExists',
  REVIEW_ALREADY_HIDDEN: 'error.reviewHidden',
  CONTACT_CONFLICT: 'error.contactConflict',
  REORDER_CONFLICT: 'error.reorderConflict',
  PORTFOLIO_REORDER_CONFLICT: 'error.reorderConflict',
  NO_PENDING_VERIFICATION: 'error.noPendingVerification',
  ORG_ALREADY_VERIFIED: 'error.orgAlreadyVerified',
  INVALID_STATUS_TRANSITION: 'error.invalidStatusTransition',
  MAINTENANCE_MODE: 'error.maintenanceMode',
};

export function userMessageKeyOf(error: unknown): ToastErrorKey {
  const mapped = mapToApiError(error);
  const business = BUSINESS_ERROR_KEYS[mapped.code];
  if (business) return business;

  if (mapped.statusCode === 0) {
    if (mapped.code === 'TIMEOUT') return 'error.timeout';
    if (mapped.code === 'NETWORK_ERROR') return 'error.network';
    return 'error.generic';
  }

  switch (mapped.statusCode) {
    case 400:
      return 'error.badRequest';
    case 401:
      return 'error.sessionExpired';
    case 403:
      return 'error.forbidden';
    case 404:
      return 'error.notFound';
    case 409:
      return 'error.conflict';
    case 413:
      return 'error.payloadTooLarge';
    case 422:
      return 'error.validation';
    case 429:
      return 'error.rateLimited';
    default:
      return mapped.statusCode >= 500 ? 'error.server' : 'error.generic';
  }
}
