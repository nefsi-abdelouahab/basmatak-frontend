import { notFound } from 'next/navigation';

// Catches every unmatched path under a valid locale and routes it through
// app/[locale]/not-found.tsx (Next only resolves that boundary via notFound()).
export default function LocaleCatchAll() {
  notFound();
}
