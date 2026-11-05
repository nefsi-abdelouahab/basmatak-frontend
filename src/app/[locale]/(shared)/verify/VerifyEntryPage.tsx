'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { normalizeVerificationCode } from '@/lib/api/verify';

// Public certificate entry form. Accepts a bare code or a pasted verification
// URL; the canonical code is resolved client-side so the URL the user lands on
// is always `/verify/<CODE>` (the backend does the same normalization).

export function VerifyEntryPage() {
  const t = useTranslations('verify');
  const router = useRouter();
  const [value, setValue] = useState('');
  const code = normalizeVerificationCode(value);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code === '') return;
    router.push(`/verify/${encodeURIComponent(code)}`);
  }

  return (
    <Container testId="verify-entry" variant="narrow" className="py-10">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-status-success" aria-hidden="true" />
            <h1 className="text-xl font-bold text-ink">{t('entry.title')}</h1>
          </div>
          <p className="text-sm leading-relaxed text-ink-muted">{t('entry.subtitle')}</p>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label htmlFor="verification-code" className="text-sm font-medium text-ink">
              {t('entry.label')}
            </label>
            <input
              id="verification-code"
              name="verification-code"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={t('entry.placeholder')}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              dir="ltr"
              maxLength={200}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-base tracking-widest text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-strong"
            />
            <Button type="submit" disabled={code === ''}>
              {t('entry.submit')}
            </Button>
          </form>
          <p className="text-xs text-ink-muted">{t('entry.hint')}</p>
        </div>
      </Card>
    </Container>
  );
}
