import { Container } from "react-bootstrap";
import { requireUser, isAdmin } from "@/lib/session";
import { AppNavbar } from "@/components/AppNavbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const admin = await isAdmin(user.id as string);
  return (
    <>
      {/* Per-user @font-face rules for uploaded / Google-imported fonts, so the
          editor canvas, template thumbnails and fonts overview all render them.
          Bundled fonts come from the build-time _fonts.scss. */}
      <link rel="stylesheet" href="/api/fonts/css" />
      <AppNavbar email={user.email} isAdmin={admin} />
      <Container as="main" fluid="lg" className="py-4 py-lg-5">
        {children}
      </Container>
    </>
  );
}
