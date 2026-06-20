import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Link href="/" className="auth-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bee/beeroniza-bee-mark.png" alt="" width={28} height={28} />
          Beeroniza
        </Link>
        {children}
      </div>
    </div>
  );
}
