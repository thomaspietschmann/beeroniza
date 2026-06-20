import { requireUser } from "@/lib/session";

// Full-bleed layout for the editor. The parent (app) layout already renders the
// AppNavbar; this layout adds no extra chrome and the editor breaks out of the
// parent Container via CSS (see .bnz-editor in _editor.scss) to use the full
// viewport width. Auth is still enforced here.
export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <div className="bnz-editor-shell">{children}</div>;
}
