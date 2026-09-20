"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";

/**
 * The administrator navigation. A persistent rail rather than the shared AppHeader: this role
 * moves between four dense screens, so the destinations stay visible and each page keeps its
 * full height. The employee area continues to use AppHeader.
 */
const LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/cases", label: "Cases", exact: false },
  { href: "/admin/employees", label: "Employees", exact: false },
  { href: "/admin/transactions", label: "Transactions", exact: false },
];

export function AdminSidebar({ openCases }: { openCases: number }) {
  const pathname = usePathname();

  const isCurrent = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 flex-col gap-4 border-line bg-surface max-md:border-b md:sticky md:top-0 md:h-screen md:w-[220px] md:border-r md:py-4"
    >
      <div className="px-4 pt-4 md:pt-0">
        <Logo href="/admin" />
      </div>

      <ul className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:pb-0">
        {LINKS.map((link) => {
          const current = isCurrent(link.href, link.exact);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`flex h-9 items-center gap-2 whitespace-nowrap rounded-[6px] px-3 text-sm transition-colors hover:bg-slate-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate ${
                  current ? "bg-slate-tint font-semibold text-slate" : "text-ink"
                }`}
              >
                {link.label}
                {link.label === "Cases" && openCases > 0 ? (
                  <span className="rounded-[10px] bg-copper-tint px-[7px] text-xs font-semibold tabular-nums text-copper-text">
                    {openCases}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
