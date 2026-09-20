"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Container } from "./section";
import { nav } from "./content";

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <Container className="flex h-14 items-center gap-4">
        <Logo href="/" />
        <nav aria-label="Main" className="hidden flex-1 items-center justify-center gap-7 md:flex">
          {nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-control text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden h-9 sm:inline-flex">
            <Link href={nav.logIn.href}>{nav.logIn.label}</Link>
          </Button>
          <Button asChild size="sm" className="h-9">
            <Link href={nav.getStarted.href}>{nav.getStarted.label}</Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="md:hidden"
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" strokeWidth={1.5} /> : <Menu aria-hidden="true" strokeWidth={1.5} />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </Button>
        </div>
      </Container>
      {open ? (
        <nav
          id="landing-mobile-nav"
          aria-label="Mobile"
          className="border-t border-line bg-surface md:hidden"
        >
          <Container className="flex flex-col gap-1 py-3">
            {nav.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-control px-2 py-2 text-sm"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link
              href={nav.logIn.href}
              className="rounded-control px-2 py-2 text-sm sm:hidden"
              onClick={() => setOpen(false)}
            >
              {nav.logIn.label}
            </Link>
          </Container>
        </nav>
      ) : null}
    </header>
  );
}
