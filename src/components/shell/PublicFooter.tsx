import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { FooterLegalLink } from './FooterLegal';

// Public footer: brand + columns link to real routes only, plus the legal
// documents (About, Privacy, Terms), which open as modals in place instead
// of navigating. Columns and styling are unchanged.
export async function PublicFooter({ locale }: { locale: string }) {
  const tCommon = await getTranslations({ locale, namespace: 'common' });
  const t = await getTranslations({ locale, namespace: 'publicOrgs' });
  const year = new Date().getFullYear();

  return (
    <footer data-testid="public-footer" className="mt-auto w-full border-t border-border-muted bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Image
              src="/logo.png"
              alt={tCommon('appName')}
              width={419}
              height={596}
              className="h-14 w-auto object-contain sm:h-16"
            />
            <p className="text-sm leading-relaxed text-ink-muted">{t('footer.tagline')}</p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-ink">{t('footer.platformTitle')}</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/volunteer/opportunities"
                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  {t('footer.opportunities')}
                </Link>
              </li>
              <li>
                <Link href="/talents" className="text-sm text-ink-muted transition-colors hover:text-ink">
                  {t('footer.talents')}
                </Link>
              </li>
              <li>
                <FooterLegalLink docId="about" />
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-ink">{t('footer.orgsTitle')}</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/create-account?type=organization"
                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  {t('footer.registerOrg')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-ink">{t('footer.accountTitle')}</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="text-sm text-ink-muted transition-colors hover:text-ink">
                  {t('footer.signIn')}
                </Link>
              </li>
              <li>
                <Link
                  href="/create-account"
                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  {t('footer.createAccount')}
                </Link>
              </li>
              <li>
                <FooterLegalLink docId="privacy" />
              </li>
              <li>
                <FooterLegalLink docId="terms" />
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border-muted pt-8 text-sm text-ink-muted md:flex-row">
          <p>{t('footer.rights', { year })}</p>
          <p className="text-center text-xs md:text-end">{t('footer.note')}</p>
        </div>
      </div>
    </footer>
  );
}
