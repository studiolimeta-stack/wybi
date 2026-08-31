import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/** A server-rendered table heading that keeps sorting URL-driven and bookmarkable. */
export function AdminSortHeader({ children, active, direction, href, className = '' }) {
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th className={`py-2 ${className}`} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}>
      <a href={href} className="inline-flex items-center gap-1 hover:text-accent" title="Sort this column">
        {children}
        <Icon className={`h-3.5 w-3.5 ${active ? 'text-accent' : 'text-muted'}`} aria-hidden="true" />
      </a>
    </th>
  );
}
