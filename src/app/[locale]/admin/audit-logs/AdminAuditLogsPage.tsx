'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity,
  ArrowUpDown,
  Award,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Flag,
  History,
  Info,
  Megaphone,
  RotateCw,
  Search,
  Settings,
  Tag,
  User,
  UserPlus,
  UserX,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Empty } from '@/components/ui/Empty';
import { Loader } from '@/components/ui/Loader';
import { ForbiddenScreen } from '@/components/system';
import {
  auditRows,
  type AdminAuditFilters,
  type AdminAuditRow,
  type AuditDisplayRow,
} from '@/lib/api/adminAnalytics';
import { errorStateFor, ApiError } from '@/lib/api/errors';
import { getLoginHref, useSessionQuery } from '@/hooks/useSession';
import {
  useAdminAuditBrowserQuery,
  useAdminAuditLogsCsvExportMutation,
} from '@/hooks/useAdminAnalytics';

function SectionError({ message, testId }: { message: string; testId: string }) {
  return (
    <p data-testid={testId} role="alert" className="text-sm text-status-error">
      {message}
    </p>
  );
}

function formatDateTime(value: string | null | undefined, locale: string): string {
  if (typeof value !== 'string' || value === '') return '—';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '—';
  return new Date(value).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Same action→icon reading as the dashboard activity strip: the icon is
// picked from the stored action/method/path text, never from a badge map.
function auditIconFor(entry: {
  action: string | null;
  method: string | null;
  path: string | null;
}): LucideIcon {
  const haystack = `${entry.action ?? ''} ${entry.method ?? ''} ${entry.path ?? ''}`.toLowerCase();
  if (haystack.includes('signup') || haystack.includes('register')) return UserPlus;
  if (haystack.includes('verif') || haystack.includes('approv')) return BadgeCheck;
  if (haystack.includes('report') && (haystack.includes('resolv') || haystack.includes('dismiss')))
    return CircleCheck;
  if (haystack.includes('report')) return Flag;
  if (haystack.includes('suspend')) return UserX;
  if (haystack.includes('publish') || haystack.includes('opportunit')) return Megaphone;
  if (haystack.includes('submi')) return FileCheck2;
  if (haystack.includes('experience')) return Award;
  if (haystack.includes('maintenance') || haystack.includes('setting')) return Settings;
  return Activity;
}

// Compact filter control with a leading icon (mockup control-bar style).
// Logical properties only so RTL mirrors automatically.
function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  Icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  Icon: LucideIcon;
}) {
  return (
    <div className="relative min-w-[10rem] flex-1">
      <Icon
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <select
        id={id}
        aria-label={label}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-border bg-surface ps-9 pe-8 text-sm text-ink focus:border-primary focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronRight
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rotate-90 text-ink-muted"
      />
    </div>
  );
}

function AuditDetail({
  row,
  display,
  onClose,
}: {
  row: AdminAuditRow;
  display: AuditDisplayRow;
  onClose: () => void;
}) {
  const t = useTranslations('adminOverview');
  const locale = useLocale();
  const Icon = auditIconFor(display);
  const log = row.log ?? {};
  const entityType = typeof log.entityType === 'string' ? log.entityType : '';
  const entityId =
    typeof log.entityId === 'string'
      ? log.entityId
      : typeof log.entityId === 'number'
        ? String(log.entityId)
        : '';
  const actorId = typeof log.actorId === 'string' ? log.actorId : '';
  const method = typeof log.method === 'string' ? log.method : '';
  const path = typeof log.path === 'string' ? log.path : '';
  const fields: { Icon: LucideIcon; label: string; value: string; mono?: boolean }[] = [
    {
      Icon: History,
      label: t('audit.timeLabel'),
      value: formatDateTime(
        typeof log.createdAt === 'string' ? log.createdAt : null,
        locale,
      ),
    },
    {
      Icon: User,
      label: t('audit.actorLabel'),
      value:
        display.actor ??
        (actorId === '' ? t('audit.nameUnavailable') : actorId),
      mono: display.actor === null && actorId !== '',
    },
    {
      Icon: Activity,
      label: t('audit.actionLabel'),
      value: display.action ?? t('audit.valueUnavailable'),
    },
    {
      Icon: Info,
      label: t('audit.methodLabel'),
      value: method === '' ? t('audit.valueUnavailable') : method,
      mono: method !== '',
    },
    {
      Icon: FileText,
      label: t('audit.pathLabel'),
      value: path === '' ? t('audit.valueUnavailable') : path,
      mono: path !== '',
    },
    {
      Icon: Tag,
      label: t('browser.fieldEntity'),
      value:
        entityType === ''
          ? t('audit.valueUnavailable')
          : entityId === ''
            ? entityType
            : `${entityType} · ${entityId}`,
      mono: true,
    },
    {
      Icon: Tag,
      label: t('audit.targetLabel'),
      value: display.target ?? t('audit.nameUnavailable'),
    },
  ];
  return (
    <div data-testid="admin-audit-detail" className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-ink">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            <Icon size={16} aria-hidden="true" className="shrink-0" />
          </span>
          <span className="min-w-0 break-words">
            {display.action ?? t('audit.valueUnavailable')}
          </span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('shared.close')}
          title={t('browser.detailClose')}
          onClick={onClose}
          className="xl:hidden"
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>
      <dl className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
        {fields.map((field) => (
          <div key={field.label} className="flex items-start gap-2">
            <field.Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
            <dt className="shrink-0 text-ink-muted">{field.label}</dt>
            <dd
              className={`ms-auto min-w-0 break-words text-end text-ink ${
                field.mono ? 'font-mono text-xs' : ''
              }`}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Audit-log browser: the full filterable read behind the dashboard activity
// strip (`GET /admin/audit-logs` with actor/entityType/entityId/date/q/sort
// plus CSV export). Read-only rows with enriched actor/target names; the same
// master-table + inspection-drawer structure as the other admin screens. No
// figures are computed here — counts come from the page `total`.
export function AdminAuditLogsPage({ locale }: { locale: string }) {
  const t = useTranslations('adminOverview');
  const router = useRouter();
  const activeLocale = useLocale() || locale;
  const session = useSessionQuery();
  const next = '/admin/audit-logs';
  const isAdmin = !session.isPending && !session.isError && session.data?.role === 'admin';

  const [actor, setActor] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [date, setDate] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [limit, setLimit] = useState(20);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  const [csvError, setCsvError] = useState(false);

  const filters: AdminAuditFilters = useMemo(
    () => ({
      actor: actor === '' ? undefined : actor,
      entityType: entityType === '' ? undefined : entityType,
      entityId: entityId === '' ? undefined : entityId,
      date: date === '' ? undefined : date,
      q: q === '' ? undefined : q,
      sort,
      limit,
      cursor,
    }),
    [actor, entityType, entityId, date, q, sort, limit, cursor],
  );
  const listQuery = useAdminAuditBrowserQuery(filters, isAdmin);
  const csvMutation = useAdminAuditLogsCsvExportMutation();
  const forbidden =
    listQuery.error instanceof ApiError && errorStateFor(listQuery.error) === 'forbidden';

  const resetPage = () => {
    setCursor(undefined);
    setCursorHistory([]);
  };

  // Close the drawer on Escape.
  useEffect(() => {
    if (selectedKey === undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedKey(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedKey]);

  useEffect(() => {
    if (session.isError) router.replace(getLoginHref(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isError, router, locale]);

  const clearFilters = () => {
    setActor('');
    setEntityType('');
    setEntityId('');
    setDate('');
    setQ('');
    setSort('newest');
    resetPage();
  };

  const goNext = () => {
    const nextCursor = listQuery.data?.nextCursor;
    if (!nextCursor) return;
    setCursorHistory((history) => (cursor ? [...history, cursor] : history));
    setCursor(nextCursor);
  };

  const goBack = () => {
    setCursorHistory((history) => {
      const previous = history[history.length - 1];
      setCursor(previous);
      return history.slice(0, -1);
    });
  };

  const onExportCsv = () => {
    setCsvError(false);
    csvMutation.mutate(
      {
        actor: actor === '' ? undefined : actor,
        entityType: entityType === '' ? undefined : entityType,
        entityId: entityId === '' ? undefined : entityId,
        date: date === '' ? undefined : date,
        q: q === '' ? undefined : q,
        sort,
      },
      { onError: () => setCsvError(true) },
    );
  };

  const rows = auditRows(listQuery.data ?? { items: [], nextCursor: null, total: 0 });
  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const selectedIndex = rows.findIndex((row) => row.key === selectedKey);
  const selected = selectedIndex >= 0 ? rows[selectedIndex] : undefined;
  const selectedRaw = selectedIndex >= 0 ? items[selectedIndex] : undefined;

  if (session.isPending) {
    return (
      <div data-testid="admin-audit-logs" className="flex min-w-0 flex-col gap-6">
        <Loader label={t('shared.loading')} />
      </div>
    );
  }

  if (session.isError) return null;

  if (!isAdmin || forbidden) {
    return (
      <div data-testid="admin-audit-logs-forbidden" className="min-w-0">
        <ForbiddenScreen />
      </div>
    );
  }

  return (
    <Container testId="admin-audit-logs" className="flex min-w-0 flex-col gap-6 py-6">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-sm text-ink-muted"
      >
        <span>{t('browser.crumbsAdministration')}</span>
        <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
        <span>{t('browser.crumbsSystem')}</span>
        <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
        <span aria-current="page" className="font-medium text-ink">
          {t('browser.crumbsCurrent')}
        </span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">{t('browser.title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('browser.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="admin-audit-q"
              type="search"
              value={q}
              placeholder={t('browser.headerSearchPlaceholder')}
              aria-label={t('browser.headerSearchPlaceholder')}
              onChange={(event) => {
                setQ(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="admin-audit-csv"
            disabled={csvMutation.isPending}
            onClick={onExportCsv}
            className="h-10"
          >
            <Download size={14} aria-hidden="true" />
            {csvMutation.isPending ? t('browser.exporting') : t('browser.exportCta')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={t('browser.refreshCta')}
            title={t('browser.refreshCta')}
            disabled={listQuery.isFetching}
            onClick={() => void listQuery.refetch()}
            className="h-10 w-10"
          >
            <RotateCw size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {csvError ? (
        <p data-testid="admin-audit-csv-error" role="alert" className="text-sm text-status-error">
          {t('browser.csvError')}
        </p>
      ) : null}

      <Card title={t('browser.filtersTitle')}>
        <div data-testid="admin-audit-filters" className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <User
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="admin-audit-actor"
              aria-label={t('browser.actorLabel')}
              title={t('browser.actorLabel')}
              placeholder={t('browser.actorPlaceholder')}
              value={actor}
              onChange={(event) => {
                setActor(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
          </div>
          <div className="relative min-w-[10rem] flex-1">
            <Tag
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="admin-audit-entity-type"
              aria-label={t('browser.entityTypeLabel')}
              title={t('browser.entityTypeLabel')}
              placeholder={t('browser.entityTypePlaceholder')}
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
          </div>
          <div className="relative min-w-[10rem] flex-1">
            <Info
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="admin-audit-entity-id"
              aria-label={t('browser.entityIdLabel')}
              title={t('browser.entityIdLabel')}
              placeholder={t('browser.entityIdPlaceholder')}
              value={entityId}
              onChange={(event) => {
                setEntityId(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
          </div>
          <div className="relative min-w-[10rem] flex-1">
            <CalendarDays
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="admin-audit-date"
              type="date"
              aria-label={t('browser.dateLabel')}
              title={t('browser.dateLabel')}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm text-ink focus:border-primary focus:outline-none"
            />
          </div>
          <FilterSelect
            id="admin-audit-sort"
            label={t('browser.sortLabel')}
            value={sort}
            onChange={(value) => {
              setSort(value === 'oldest' ? 'oldest' : 'newest');
              resetPage();
            }}
            Icon={ArrowUpDown}
            options={[
              { value: 'newest', label: t('browser.sortNewest') },
              { value: 'oldest', label: t('browser.sortOldest') },
            ]}
          />
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-10">
            <X size={14} aria-hidden="true" />
            {t('browser.clearFilters')}
          </Button>
        </div>
      </Card>

      {listQuery.isPending ? <Loader label={t('shared.loading')} /> : null}
      {listQuery.isError && !forbidden ? (
        <SectionError testId="admin-audit-logs-error" message={t('shared.loadError')} />
      ) : null}

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Card className="min-w-0 p-0 xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-ink-muted">
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('browser.colTime')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('browser.colActor')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('browser.colAction')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t('browser.colTarget')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    <span className="sr-only">{t('browser.detailTitle')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted text-sm">
                {rows.map((row) => {
                  const rowSelected = row.key === selectedKey;
                  const Icon = auditIconFor(row);
                  const action = row.action ?? t('audit.valueUnavailable');
                  const route = [row.method, row.path].filter(Boolean).join(' ');
                  return (
                    <tr
                      key={row.key}
                      onClick={() => setSelectedKey(row.key)}
                      aria-selected={rowSelected}
                      className={`cursor-pointer transition-colors hover:bg-surface-muted ${
                        rowSelected ? 'bg-primary-tint/40' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-muted">
                        {formatDateTime(row.createdAt, activeLocale)}
                      </td>
                      <td
                        className="max-w-[10rem] truncate px-4 py-3 text-ink-muted"
                        title={row.actor ?? undefined}
                      >
                        {row.actor ?? t('audit.nameUnavailable')}
                      </td>
                      <td className="max-w-[16rem] px-4 py-3">
                        <p className="flex items-center gap-1.5 font-medium text-ink">
                          <Icon size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
                          <span className="truncate" title={action}>
                            {action}
                          </span>
                        </p>
                        {route === '' ? null : (
                          <p className="truncate font-mono text-xs text-ink-muted" title={route}>
                            {route}
                          </p>
                        )}
                      </td>
                      <td
                        className="max-w-[10rem] truncate px-4 py-3 text-ink-muted"
                        title={row.target ?? undefined}
                      >
                        {row.target ?? t('audit.nameUnavailable')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-testid={`admin-audit-open-${row.key}`}
                          aria-label={t('browser.inspect')}
                          title={t('browser.inspect')}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedKey(row.key);
                          }}
                        >
                          <Eye size={16} aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {listQuery.data && rows.length === 0 ? (
            <div className="p-4">
              <Empty title={t('audit.empty')} />
            </div>
          ) : null}
          {listQuery.data ? (
            <div className="flex flex-col gap-3 border-t border-border-muted px-4 py-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
              <p data-testid="admin-audit-count">
                {t('browser.showing', { shown: rows.length, total })}
                {typeof listQuery.data.page === 'number' &&
                typeof listQuery.data.pages === 'number' &&
                listQuery.data.pages > 0
                  ? ` · ${t('browser.pageOf', {
                      page: listQuery.data.page,
                      pages: listQuery.data.pages,
                    })}`
                  : null}
              </p>
              <div className="flex items-center gap-2">
                {cursorHistory.length > 0 || cursor ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="admin-audit-back"
                    onClick={goBack}
                  >
                    {t('browser.prevPage')}
                  </Button>
                ) : null}
                {listQuery.data.nextCursor ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="admin-audit-next"
                    onClick={goNext}
                  >
                    {t('browser.nextPage')}
                  </Button>
                ) : null}
                <label
                  htmlFor="admin-audit-limit"
                  className="flex items-center gap-1.5 border-s border-border ps-3"
                >
                  {t('browser.perPage')}
                  <select
                    id="admin-audit-limit"
                    value={String(limit)}
                    onChange={(event) => {
                      setLimit(Number(event.target.value) || 20);
                      resetPage();
                    }}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="20">20</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null}
        </Card>

        {selected && selectedRaw ? (
          <>
            <div
              aria-hidden="true"
              onClick={() => setSelectedKey(undefined)}
              className="fixed inset-0 z-30 bg-ink/40 xl:hidden"
            />
            <aside
              aria-label={t('browser.detailTitle')}
              className="fixed inset-y-0 end-0 z-40 w-[min(94vw,30rem)] overflow-y-auto border-s border-border bg-surface p-4 shadow-modal xl:sticky xl:top-20 xl:z-auto xl:col-span-1 xl:w-auto xl:self-start xl:overflow-visible xl:rounded-xl xl:border xl:p-4 xl:shadow-sm"
            >
              <AuditDetail
                key={selected.key}
                row={selectedRaw}
                display={selected}
                onClose={() => setSelectedKey(undefined)}
              />
            </aside>
          </>
        ) : null}
      </div>
    </Container>
  );
}
