import Image from 'next/image';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Container } from '@/components/ui/Container';
import { LanguageSwitcher } from '@/components/shell/LanguageSwitcher';

// Split-screen auth frame, exactly 100dvh with no page scroll: the grid is
// height-bounded (flex-1 inside a min-h-dvh column), the form panel scrolls
// internally when its content overflows, and the image panel is height-locked
// so its fill image can never be squeezed. First in DOM order = start side,
// so grid auto-placement mirrors form/image correctly in RTL.
// `fit: 'cover'` for edge-safe photos, `'contain'` (white panel, ink tagline)
// for edge-critical subjects where cropping is unacceptable.
export function AuthSplit({
  testId,
  title,
  subtitle,
  imageSrc,
  fit,
  tagline,
  backHref,
  backLabel,
  children,
}: {
  testId: string;
  title: string;
  subtitle: string;
  imageSrc: string;
  fit: 'cover' | 'contain';
  tagline: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  const tCommon = useTranslations('common');

  return (
    <div data-testid={testId} className="grid min-h-0 w-full flex-1 lg:grid-cols-2">
      <section className="flex min-h-0 flex-col overflow-y-auto bg-surface">
        <Container variant="narrow" className="flex min-h-full flex-col justify-center gap-6 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-1">
              <Link
                href={backHref}
                aria-label={backLabel}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <ArrowLeft aria-hidden="true" size={18} className="rtl:rotate-180" />
              </Link>
              <Link href="/" aria-label={tCommon('appName')}>
                <Image
                  src="/logo.png"
                  alt={tCommon('appName')}
                  width={419}
                  height={596}
                  className="h-10 w-auto object-contain"
                  priority
                />
              </Link>
            </div>
            <LanguageSwitcher />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-headline-lg text-ink">{title}</h1>
            <p className="text-body-md text-ink-muted">{subtitle}</p>
          </div>
          {children}
        </Container>
      </section>
      <aside
        aria-hidden="true"
        className={`relative hidden min-h-0 lg:block ${fit === 'contain' ? 'bg-surface' : ''}`}
      >
        <Image
          src={imageSrc}
          alt=""
          fill
          sizes="50vw"
          className={fit === 'contain' ? 'object-contain object-center' : 'object-cover object-center'}
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
        <p
          className={`absolute inset-x-0 bottom-0 p-8 text-headline-md ${
            fit === 'contain' ? 'text-ink' : 'text-white'
          }`}
        >
          {tagline}
        </p>
      </aside>
    </div>
  );
}
