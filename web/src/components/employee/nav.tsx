"use client";

import { LayoutDashboard, Receipt } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/employee", label: "My record", icon: LayoutDashboard },
  { href: "/employee/expenses/new", label: "New expense", icon: Receipt },
] as const;

export function EmployeeNav() {
  const pathname = usePathname();
  return (
    <>
      {links.map((link) => {
        const current = pathname === link.href;
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-control px-3 text-sm md:w-full",
              current ? "bg-slate-tint font-semibold text-slate" : "text-ink hover:bg-slate-tint",
            )}
          >
            <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
