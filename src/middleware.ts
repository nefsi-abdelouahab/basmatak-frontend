import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // NOTE: this file must live at src/middleware.ts (not the project root).
  // Empirically verified on Next 14.2.18: a root-level middleware.ts in this
  // project is silently never loaded (no compile, no execution), so unprefixed
  // URLs fell through to app/[locale] with locale="verify-email", which
  // notFound()s into a document-less 404 -> hydration crash + blank page.
  //
  // '/' + already-prefixed paths keep existing behaviour; the negative
  // lookahead catches every *unprefixed* app route (/verify-email,
  // /reset-password, /login, ...) so next-intl redirects it to the default
  // locale instead of 404ing. api/_next/_vercel/static files stay excluded.
  matcher: ['/', '/(en|ar)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
