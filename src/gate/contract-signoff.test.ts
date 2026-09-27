import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLoginHref } from '../hooks/useSession';
import {
  MAX_MEDIA_BYTES,
  MEDIA_IMAGE_MIMES,
  validateImageFile,
} from '../lib/api/media';
import { downloadBlob, parseContentDisposition } from '../lib/api/download';
import { SystemStatusSchema } from '../lib/api/system';
import {
  EVIDENCE_MIMES,
  MAX_EVIDENCE_BYTES,
  isAllowedEvidenceLink,
  isConsentRequiredError,
  validateEvidenceFile,
} from '../lib/api/submissions';
import {
  experiencesGateOpen,
  portfolioGateOpen,
  registryCode,
} from '../lib/api/publicTalent';

// F19 contract-change sign-off — the §2 backend behavior rows the UI depends
// on (roadmap §4 F19 "plus a contract-change sign-off"). Each row names the
// backend behavior, the frontend pin, and the executable assertion below.
// Owner sign-off is recorded by keeping this suite green: any backend drift
// that breaks a row turns the gate red before a screen regresses.

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..');

describe('F19 sign-off: §2 backend behavior rows the UI depends on', () => {
  it('opt-out publics: closed show-flags hide blocks but never the identity', () => {
    // Backend: a closed show-flag yields a null block; the frontend renders a
    // block only when its data is non-null. Username + VOL-registryId survive
    // every opt-out (never gated, never a route key).
    expect(registryCode('VOL-000042', 'VOL')).toBe('VOL-000042');
    expect(registryCode('000042', 'VOL')).toBe('VOL-000042');
    expect(experiencesGateOpen({ experiences: null } as never)).toBe(false);
    expect(experiencesGateOpen({ experiences: [] } as never)).toBe(true);
    expect(portfolioGateOpen({ portfolio: null } as never)).toBe(false);
    expect(portfolioGateOpen({ portfolio: { items: [] } } as never)).toBe(true);
    expect(experiencesGateOpen(null)).toBe(false);
  });

  it('guest-redirect: backend only 401s; the frontend owns the login redirect', () => {
    // Decision 10: guest authed actions (Apply, Save/favorite, every authed
    // action on public screens) redirect to Login with a locale-less next.
    expect(getLoginHref()).toBe('/login');
    expect(getLoginHref('/volunteer/opportunities')).toBe('/login?next=%2Fvolunteer%2Fopportunities');
  });

  it('upload constraints: images/PDF ≤5 MB, video as allowlisted link only', () => {
    // Avatar path (F2): images only. Evidence path (F7): images + PDF, same
    // 5 MB ceiling, video-by-link on the youtube/drive allowlist.
    expect(MAX_MEDIA_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_EVIDENCE_BYTES).toBe(5 * 1024 * 1024);
    expect([...MEDIA_IMAGE_MIMES]).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect([...EVIDENCE_MIMES]).toEqual(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    expect(validateImageFile({ name: 'a.jpg', type: 'image/jpeg', size: 1024 }).ok).toBe(true);
    expect(validateImageFile({ name: 'a.mp4', type: 'video/mp4', size: 1024 })).toMatchObject({
      ok: false,
      reason: 'type',
    });
    expect(validateEvidenceFile({ name: 'doc.pdf', type: 'application/pdf', size: 1024 }).ok).toBe(true);
    expect(validateEvidenceFile({ name: 'clip.mp4', type: 'video/mp4', size: 1024 })).toMatchObject({
      ok: false,
      reason: 'type',
    });
    expect(
      validateEvidenceFile({ name: 'big.pdf', type: 'application/pdf', size: 6 * 1024 * 1024 }),
    ).toMatchObject({ ok: false, reason: 'size' });
    expect(isAllowedEvidenceLink('https://youtu.be/abc').ok).toBe(true);
    expect(isAllowedEvidenceLink('https://drive.google.com/file/d/1').ok).toBe(true);
    expect(isAllowedEvidenceLink('https://vimeo.com/123').ok).toBe(false);
    expect(isConsentRequiredError({ code: 'CONSENT_REQUIRED' })).toBe(true);
  });

  it('streamed exports: one blob path with Content-Disposition filenames', () => {
    expect(typeof downloadBlob).toBe('function');
    expect(parseContentDisposition('attachment; filename="org-experiences.csv"')).toBe(
      'org-experiences.csv',
    );
    expect(parseContentDisposition('attachment; filename="attestation.pdf"')).toBe('attestation.pdf');
    expect(parseContentDisposition(undefined)).toBeNull();
  });

  it('kill-switches: account states surface as distinct 403 sub-states', () => {
    const screen = fs.readFileSync(
      path.join(SRC, 'components', 'system', 'ForbiddenScreen.tsx'),
      'utf8',
    );
    for (const code of ['ACCOUNT_SUSPENDED', 'ACCOUNT_INACCESSIBLE', 'EMAIL_NOT_VERIFIED']) {
      expect(screen, code).toContain(code);
    }
  });

  it('maintenance: system status carries the flag; the screen exists', () => {
    const parsed = SystemStatusSchema.parse({
      status: 'ok',
      maintenance: true,
      message: 'Upgrade window',
    });
    expect(parsed.maintenance).toBe(true);
    expect(
      fs.existsSync(path.join(SRC, 'components', 'system', 'MaintenanceScreen.tsx')),
      'MaintenanceScreen.tsx',
    ).toBe(true);
  });
});
