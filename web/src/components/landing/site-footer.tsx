import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Container } from "./section";
import { footer } from "./content";

function FooterLink({ href, label }: { href: string; label: string }) {
  const className =
    "rounded-control text-sm text-ink-muted transition-colors duration-150 hover:text-ink";
  return href.startsWith("#") ? (
    <a href={href} className={className}>
      {label}
    </a>
  ) : (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bone">
      <Container className="grid gap-10 py-12 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div>
          <Logo href="/" />
          <p className="mt-3 max-w-[42ch] text-sm leading-6 text-ink-muted">{footer.tagline}</p>
          <p className="mt-4 max-w-[52ch] text-xs leading-5 text-ink-muted">{footer.photos}</p>
        </div>
        <div className="grid grid-cols-2 gap-8">
          {footer.columns.map((column) => (
            <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2">
              <p className="text-xs font-semibold">{column.title}</p>
              {column.links.map((link) => (
                <FooterLink key={link.href} href={link.href} label={link.label} />
              ))}
            </nav>
          ))}
        </div>
      </Container>
    </footer>
  );
}
