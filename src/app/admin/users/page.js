import { AdminShell } from '../../../components/AdminShell.js';
import { AdminDenied } from '../../../components/AdminDenied.js';
import { AdminPagination } from '../../../components/AdminPagination.js';
import { AdminSortHeader } from '../../../components/AdminSortHeader.js';
import { formatPrice } from '../../../lib/config.js';
import { listUsersForAdmin, countUsersForAdmin, getUserSummary } from '../../../lib/admin.js';
import { checkAdminAccess, adminHref } from '../../../lib/adminAuth.js';
import { currentUser } from '../../../lib/session.js';
import { PaidPill, AlertPill } from '../../../components/StatusPill.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — users', robots: { index: false, follow: false } };

const USER_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'free', label: 'Free' },
];

const PAGE_SIZE = 15;
const USER_SORT_KEYS = new Set(['access', 'name', 'provider', 'tests', 'responses', 'spent', 'joined', 'login']);

export default async function AdminUsersPage({ searchParams }) {
  const { key, users: userFilterParam, page: pageParam, sort: sortParam, dir: dirParam } = await searchParams;
  const user = await currentUser();
  const { authorized, viaToken } = checkAdminAccess({ key, user });

  if (!authorized) return <AdminDenied user={user} />;

  const userFilter = USER_FILTERS.some((f) => f.value === userFilterParam) ? userFilterParam : 'all';
  const sort = USER_SORT_KEYS.has(sortParam) ? sortParam : 'joined';
  const direction = dirParam === 'asc' ? 'asc' : 'desc';

  // Count first, then clamp the requested page into range, THEN fetch that
  // page's rows — sequential rather than parallel on purpose, so a stale or
  // hand-edited `?page=` (bookmarked from when there were more users, or just
  // typed in) can't run past the real last page and render an empty table.
  const [totalUsers, userSummary] = await Promise.all([
    countUsersForAdmin({ filter: userFilter }),
    getUserSummary(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const requestedPage = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : 1;

  const users = await listUsersForAdmin({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, filter: userFilter, sort, direction });

  // Same token-passthrough rule as the filter tabs — /admin/users/[id] is a
  // separate page, not a query param on this one, so it needs its own key.
  const userHref = (id) => (viaToken ? `/admin/users/${id}?key=${encodeURIComponent(key)}` : `/admin/users/${id}`);

  // Filter tabs deliberately don't carry `page` through (adminHref only sends
  // what's explicitly passed) — switching filters resets to page 1, which is
  // correct: "page 3 of Paid" has no guaranteed relationship to "page 3 of All".
  const pageHref = (targetPage) =>
    adminHref('/admin/users', { viaToken, key }, {
      users: userFilter === 'all' ? undefined : userFilter,
      sort,
      dir: direction,
      page: targetPage > 1 ? targetPage : undefined,
    });
  const sortHref = (nextSort) =>
    adminHref('/admin/users', { viaToken, key }, {
      users: userFilter === 'all' ? undefined : userFilter,
      sort: nextSort,
      dir: sort === nextSort && direction === 'asc' ? 'desc' : 'asc',
    });

  return (
    <AdminShell mainClassName="wrap pt-6 pb-16 space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin — Users</h1>

        <div className="grid gap-3 sm:grid-cols-5">
          {[
            { label: 'Users', value: userSummary.total },
            { label: 'Paid', value: userSummary.paid },
            { label: 'Free', value: userSummary.total - userSummary.paid },
            { label: 'Verified', value: userSummary.verified },
            { label: 'Active (30d)', value: userSummary.active_30d },
          ].map((tile) => (
            <div key={tile.label} className="card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{tile.label}</p>
              <p className="text-2xl font-extrabold">{tile.value}</p>
            </div>
          ))}
        </div>

        <div className="card p-5 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-extrabold">Users</h2>
            <div className="flex gap-1 rounded-full border-2 border-ink bg-white p-1">
              {USER_FILTERS.map((f) => (
                <a
                  key={f.value}
                  href={adminHref('/admin/users', { viaToken, key }, {
                    users: f.value === 'all' ? undefined : f.value,
                    sort,
                    dir: direction,
                  })}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    userFilter === f.value ? 'bg-ink text-white' : 'text-muted'
                  }`}
                >
                  {f.label}
                </a>
              ))}
            </div>
          </div>

          <table className="data-table mt-3 w-full text-sm">
            <thead>
              <tr className="text-left border-b-2 border-ink">
                <AdminSortHeader active={sort === 'access'} direction={direction} href={sortHref('access')}>Status</AdminSortHeader>
                <AdminSortHeader active={sort === 'name'} direction={direction} href={sortHref('name')}>Name / Email</AdminSortHeader>
                <AdminSortHeader active={sort === 'provider'} direction={direction} href={sortHref('provider')}>Sign-in</AdminSortHeader>
                <AdminSortHeader className="text-right" active={sort === 'tests'} direction={direction} href={sortHref('tests')}>Tests</AdminSortHeader>
                <AdminSortHeader className="text-right" active={sort === 'responses'} direction={direction} href={sortHref('responses')}>Responses</AdminSortHeader>
                <AdminSortHeader className="text-right" active={sort === 'spent'} direction={direction} href={sortHref('spent')}>Spent</AdminSortHeader>
                <AdminSortHeader active={sort === 'joined'} direction={direction} href={sortHref('joined')}>Joined</AdminSortHeader>
                <AdminSortHeader active={sort === 'login'} direction={direction} href={sortHref('login')}>Last login</AdminSortHeader>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td className="py-3 text-muted" colSpan={8}>
                    No accounts match this filter.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line">
                  <td className="py-2">
                    <PaidPill isPaid={u.paid_test_count > 0} />
                    {u.banned_at && <AlertPill className="ml-1">Banned</AlertPill>}
                  </td>
                  <td className="py-2">
                    <a href={userHref(u.id)} className="font-semibold underline">
                      {u.name || u.email}
                    </a>
                    <p className="hint">
                      {u.email}
                      {!u.email_verified_at && ' ⚠️ unverified'}
                    </p>
                  </td>
                  <td className="py-2">{(u.providers || []).join(', ') || '—'}</td>
                  <td className="py-2 text-right tabular-nums">{u.test_count}</td>
                  <td className="py-2 text-right tabular-nums">{u.response_count}</td>
                  <td className="py-2 text-right tabular-nums">
                    {u.total_paid > 0 ? formatPrice(u.total_paid, u.paid_currency) : '—'}
                  </td>
                  <td className="py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-2">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint mt-2">⚠️ unverified = email captured at test creation but never confirmed by a real login.</p>
          <AdminPagination page={page} totalPages={totalPages} total={totalUsers} pageSize={PAGE_SIZE} buildHref={pageHref} />
        </div>
    </AdminShell>
  );
}
