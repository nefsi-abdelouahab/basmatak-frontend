import { setRequestLocale } from 'next-intl/server';
import { OrgParticipantsPage } from '../OrgParticipantsPage';

interface ParticipantDetailRouteProps {
  params: { locale: string; participationId: string };
}

// F11-owned deep-linkable roster row (OQ1): the aggregate roster rendered
// with the linked row initially expanded (same owned route dir).
export default function OrgParticipantDetailRoute({
  params: { locale, participationId },
}: ParticipantDetailRouteProps) {
  setRequestLocale(locale);
  return <OrgParticipantsPage locale={locale} initialExpanded={participationId} />;
}
