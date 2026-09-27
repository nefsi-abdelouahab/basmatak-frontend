import { setRequestLocale } from 'next-intl/server';
import { PublicLandingPage } from './(public)/PublicLandingPage';

// F18 landing owns the locale home route. This path previously rendered the
// F0 foundation placeholder (16-line demo Card, no logic or fetches); the only
// consumers of its demo heading are the shell.spec.ts home assertions, which
// need a companion heading update (reported, owner-confirmed separately).
export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  // `home` testid preserves the F0 shell-spec anchors (navbar/sidebar/
  // bottom-nav + home heading); the heading copy is now the landing title.
  return (
    <div data-testid="home">
      <PublicLandingPage locale={locale} />
    </div>
  );
}
