# Hook-file conventions (F0 — binding on FB–FF)

1. **One hook file per session.** Each session owns exactly one `hooks/use<Domain>.ts`
   (plus shared `useSession.ts` from F0). Never edit another session's hook file —
   if it needs a change, flag it instead.
2. **Keys come from the factory.** Every `queryKey` is built with `queryKeys`
   (`src/lib/query/keys.ts`), namespaced per domain: `['domain', scope, params?]`.
3. **Components fetch only via hooks.** Hooks call one typed function per backend
   endpoint from `src/lib/api/*`. No `fetch(`/raw `axios.` outside `lib/api`.
4. **Columns, not globals.** List hooks take `{ q, sort, page, pageSize, ...filters }`
   and read totals from `CursorPage { items, nextCursor, limit, total, page, pages }`.
5. **Guest authed-actions redirect.** Apply/Save/any authed action on public screens
   redirects via `getLoginHref(locale, next)` — the backend only ever returns 401.
6. **RTL.** Use logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`);
   never physical `ml-/mr-/pl-/pr-/left-/right-` for directional layout.
