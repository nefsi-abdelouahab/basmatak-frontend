'use client';

// Documented exception to the no-hardcoded-strings rule: this boundary renders
// only when the root layout itself (including the i18n provider) has crashed,
// so catalogs are unavailable by definition. Static English, never extended —
// every other screen uses the system catalog.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Please try again.</p>
          <button type="button" onClick={() => reset()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
