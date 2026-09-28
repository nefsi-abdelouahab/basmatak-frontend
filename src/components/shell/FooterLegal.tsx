'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Info, Lock, Mail, MapPin, Phone, ScrollText } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

type DocId = 'terms' | 'privacy' | 'about';

const ICONS = { terms: ScrollText, privacy: Lock, about: Info } as const;

interface LegalSection {
  h: string;
  ps?: string[];
  bullets?: string[];
}

interface LegalOwner {
  title: string;
  name: string;
  addressLabel: string;
  address: string;
  phoneLabel: string;
  phone: string;
  emailLabel: string;
  email: string;
}

interface LegalDoc {
  label: string;
  title: string;
  updated?: string;
  intro?: string;
  sections: LegalSection[];
  tagline?: string;
  owner?: LegalOwner;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isLegalDoc(value: unknown): value is LegalDoc {
  if (!isRecord(value)) return false;
  if (typeof value.label !== 'string' || typeof value.title !== 'string') return false;
  if (value.updated !== undefined && typeof value.updated !== 'string') return false;
  if (value.intro !== undefined && typeof value.intro !== 'string') return false;
  if (value.tagline !== undefined && typeof value.tagline !== 'string') return false;
  if (!Array.isArray(value.sections)) return false;
  for (const section of value.sections) {
    if (!isRecord(section) || typeof section.h !== 'string') return false;
    if (section.ps !== undefined && !isStringArray(section.ps)) return false;
    if (section.bullets !== undefined && !isStringArray(section.bullets)) return false;
  }
  if (value.owner !== undefined) {
    const owner = value.owner;
    if (!isRecord(owner)) return false;
    for (const key of [
      'title',
      'name',
      'addressLabel',
      'address',
      'phoneLabel',
      'phone',
      'emailLabel',
      'email',
    ]) {
      if (typeof owner[key] !== 'string') return false;
    }
  }
  return true;
}

function LegalModal({ docId, onClose }: { docId: DocId; onClose: () => void }) {
  const t = useTranslations('publicOrgs');
  const raw: unknown = t.raw(`legal.${docId}`);
  if (!isLegalDoc(raw)) return null;
  const Icon = ICONS[docId];

  return (
    <Modal testId={`legal-modal-${docId}`} label={raw.title} onClose={onClose}>
      <div className="max-h-[70vh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start gap-4 pe-10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-primary">
            <Icon aria-hidden="true" size={22} />
          </div>
          <div>
            <h2 id={`legal-modal-${docId}-title`} className="text-title-lg font-semibold text-ink">
              {raw.title}
            </h2>
            {raw.updated ? <p className="mt-1 text-label-xs text-ink-muted">{raw.updated}</p> : null}
          </div>
        </div>
        {raw.intro ? <p className="mt-5 text-body-md leading-relaxed text-ink-muted">{raw.intro}</p> : null}
        <div className="mt-6 space-y-6">
          {raw.sections.map((section) => (
            <section key={section.h} aria-label={section.h}>
              <h3 className="text-title-sm font-semibold text-ink">{section.h}</h3>
              {(section.ps ?? []).map((paragraph) => (
                <p key={paragraph} className="mt-2 text-body-sm leading-relaxed text-ink-muted">
                  {paragraph}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1.5 ps-5 text-body-sm leading-relaxed text-ink-muted">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        {raw.tagline ? (
          <p className="mt-8 text-center text-title-sm font-semibold text-ink">{raw.tagline}</p>
        ) : null}
        {raw.owner ? (
          <div className="mt-6 rounded-md border border-border-muted bg-surface-muted p-4">
            <p className="text-title-sm font-semibold text-ink">{raw.owner.title}</p>
            <p className="mt-1 text-body-sm font-medium text-ink">{raw.owner.name}</p>
            <ul className="mt-3 space-y-2 text-body-sm text-ink-muted">
              <li className="flex items-start gap-2">
                <MapPin aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  {raw.owner.addressLabel}: {raw.owner.address}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Phone aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  {raw.owner.phoneLabel}: <span dir="ltr">{raw.owner.phone}</span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Mail aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  {raw.owner.emailLabel}:{' '}
                  <a dir="ltr" href={`mailto:${raw.owner.email}`} className="font-medium text-primary hover:text-primary-hover">
                    {raw.owner.email}
                  </a>
                </span>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

// Footer trigger: a link-styled button (same classes as footer links) that
// opens the document modal in place — never navigates.
export function FooterLegalLink({ docId }: { docId: DocId }) {
  const t = useTranslations('publicOrgs');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid={`footer-${docId}-link`}
        onClick={() => setOpen(true)}
        className="text-start text-sm text-ink-muted transition-colors hover:text-ink"
      >
        {t(`legal.${docId}.label`)}
      </button>
      {open ? <LegalModal docId={docId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
