import { setRequestLocale } from 'next-intl/server';
import { PublicLandingPage } from './PublicLandingPage';

// Locale home route lives inside the (public) group so the public layout
// (top navbar + footer, no sidebar) wraps it.
export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  // `home` testid preserves the shell-spec anchors (navbar/footer + home
  // heading); the heading copy is the landing title.
  return (
    <div data-testid="home">
      <PublicLandingPage locale={locale} />
    </div>
  );
}
