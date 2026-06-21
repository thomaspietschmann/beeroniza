"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import { signOutAction } from "@/app/(app)/actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/templates", label: "Templates" },
  { href: "/brand-kits", label: "Brand Kits" },
  { href: "/media", label: "Media" },
  { href: "/fonts", label: "Fonts" },
  { href: "/api-keys", label: "API Keys" },
];

export function AppNavbar({ email, isAdmin = false }: { email?: string | null; isAdmin?: boolean }) {
  const pathname = usePathname();
  const navLinks = isAdmin ? [...links, { href: "/admin", label: "Admin" }] : links;
  // The editor is a full-bleed workspace with its own back navigation; the
  // global navbar is hidden there to avoid distraction and accidental nav.
  if (pathname.startsWith("/editor/")) return null;
  return (
    <Navbar expand="lg" className="bnz-navbar" sticky="top">
      <Container fluid="lg">
        <Navbar.Brand as={Link} href="/dashboard" className="bnz-brand d-inline-flex align-items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/bee/beeroniza-bee-mark.png"
            alt=""
            width={41}
            height={36}
            className="bnz-brand-logo"
          />
          <span className="bnz-brand-word">Beeroniza</span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="bnz-nav" />
        <Navbar.Collapse id="bnz-nav">
          <Nav className="me-auto">
            {navLinks.map((l) => (
              <Nav.Link
                key={l.href}
                as={Link}
                href={l.href}
                active={pathname === l.href || pathname.startsWith(l.href + "/")}
              >
                {l.label}
              </Nav.Link>
            ))}
          </Nav>
          <div className="d-flex align-items-center gap-3">
            {email && (
              <Link href="/account" className="small text-secondary d-none d-lg-inline text-decoration-none">
                {email}
              </Link>
            )}
            <form action={signOutAction}>
              <Button type="submit" variant="outline-secondary" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
