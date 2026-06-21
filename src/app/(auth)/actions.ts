"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { createUser, RegistrationError } from "@/lib/users";
import { checkRateLimit } from "@/lib/ratelimit";

// 10 attempts per 15 minutes per IP.
const AUTH_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export interface AuthFormState {
  error: string | null;
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const ip = await clientIp();
  const rl = await checkRateLimit(`login:${ip}`, AUTH_LIMIT);
  if (!rl.allowed) {
    return { error: "Too many login attempts. Please try again later." };
  }
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // signIn's successful redirect throws NEXT_REDIRECT — must propagate.
    throw error;
  }
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");
  const ip = await clientIp();
  const rl = await checkRateLimit(`register:${ip}`, AUTH_LIMIT);
  if (!rl.allowed) {
    return { error: "Too many registration attempts. Please try again later." };
  }

  try {
    await createUser({ email, password, name });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return { error: error.message };
    }
    throw error;
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created — please log in." };
    }
    throw error;
  }
}
