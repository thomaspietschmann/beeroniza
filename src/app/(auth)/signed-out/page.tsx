import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Signed out" };

export default function SignedOutPage() {
  return (
    <>
      <h1 className="h4 mb-1">You&apos;ve been signed out</h1>
      <p className="text-secondary mb-4">See you next time.</p>
      <Link href="/login" className="btn btn-primary w-100">
        Sign in again
      </Link>
    </>
  );
}
