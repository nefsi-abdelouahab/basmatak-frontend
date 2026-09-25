'use client';

import { Button } from './Button';

export interface PaginationProps {
  page: number;
  pages: number;
  statusText: string;
  previousLabel: string;
  nextLabel: string;
  onPage: (page: number) => void;
}

export function Pagination({
  page,
  pages,
  statusText,
  previousLabel,
  nextLabel,
  onPage,
}: PaginationProps) {
  return (
    <nav className="flex items-center justify-between gap-4" aria-label={statusText}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        {previousLabel}
      </Button>
      <span className="text-sm text-ink-muted">{statusText}</span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        {nextLabel}
      </Button>
    </nav>
  );
}
