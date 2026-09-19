import { signOut } from "@/auth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

/**
 * The signed-in header: 56px, Surface, 1px bottom line, logo at 24px on the left.
 * `nav` and `actions` are slots so the admin and employee streams add their own links and the
 * notification bell without editing this file.
 */
export function AppHeader({
  homeHref,
  userName,
  roleLabel,
  nav,
  actions,
}: {
  homeHref: string;
  userName: string;
  roleLabel: string;
  nav?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-6">
        <Logo href={homeHref} />
        <nav aria-label="Main" className="flex flex-1 items-center gap-4">
          {nav}
        </nav>
        <div className="flex items-center gap-3">
          {actions}
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold">{userName}</div>
            <div className="text-xs text-ink-muted">{roleLabel}</div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="secondary" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
