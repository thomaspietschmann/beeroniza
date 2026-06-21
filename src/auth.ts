import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { env } from "@/lib/env";
import { findOrCreateOidcUser } from "@/lib/users";

// A pre-hashed bcrypt hash (cost 12, value "dummy") used to run a constant-
// time bcrypt.compare when the user account does not exist, preventing a timing
// side-channel that would distinguish "user not found" from "wrong password".
const DUMMY_HASH = "$2b$12$InvalidHashUsedOnlyForTimingProtectionXXXXXXXXXX";

// Credentials + JWT sessions. We deliberately avoid the database session
// strategy and edge middleware so the whole auth path runs in the Node runtime
// (bcrypt + Prisma are not edge-compatible). Pages are protected with server
// side `auth()` checks instead.

const oidcConfigured = !!(env.oidcIssuer && env.oidcClientId && env.oidcClientSecret);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Always run bcrypt even when the user doesn't exist so that timing
        // cannot distinguish "user not found" from "wrong password".
        const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
        const ok = await verifyPassword(password, hashToCheck);
        if (!user || !user.passwordHash || !ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        };
      },
    }),
    ...(oidcConfigured
      ? [
          {
            id: "oidc",
            name: env.oidcName,
            type: "oidc" as const,
            issuer: env.oidcIssuer,
            clientId: env.oidcClientId,
            clientSecret: env.oidcClientSecret,
          },
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "oidc") {
        if (!profile?.email) return false;
        await findOrCreateOidcUser(
          profile.email,
          typeof profile.name === "string" ? profile.name : null,
        );
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // Credentials: authorize() returns { id: <internal db id> }
      if (account?.provider === "credentials" && user?.id) {
        token.uid = user.id;
      }
      // OIDC: Auth.js puts the OIDC subject in user.id; resolve our own DB id
      // by the email that Auth.js extracted from the token/userinfo endpoint.
      if (account?.provider === "oidc" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: String(token.email) },
          select: { id: true },
        });
        if (dbUser) token.uid = dbUser.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = String(token.uid);
      }
      return session;
    },
  },
});
