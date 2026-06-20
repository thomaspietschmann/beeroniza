"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { loginAction, registerAction, type AuthFormState } from "@/app/(auth)/actions";

const initial: AuthFormState = { error: null };

export function LoginForm({
  allowRegistration = true,
  oidcEnabled = false,
  oidcName = "SSO",
}: {
  allowRegistration?: boolean;
  oidcEnabled?: boolean;
  oidcName?: string;
}) {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <div className="d-grid gap-3">
      {oidcEnabled && (
        <>
          <Button
            variant="outline-secondary"
            size="lg"
            onClick={() => void signIn("oidc", { callbackUrl: "/dashboard" })}
          >
            Sign in with {oidcName}
          </Button>
          <div className="d-flex align-items-center gap-2">
            <hr className="flex-grow-1 m-0" />
            <span className="small text-secondary">or</span>
            <hr className="flex-grow-1 m-0" />
          </div>
        </>
      )}
      <Form action={action} className="d-grid gap-3">
        {state.error && <Alert variant="danger" className="mb-0">{state.error}</Alert>}
        <Form.Group controlId="login-email">
          <Form.Label>Email</Form.Label>
          <Form.Control name="email" type="email" autoComplete="email" required autoFocus />
        </Form.Group>
        <Form.Group controlId="login-password">
          <Form.Label>Password</Form.Label>
          <Form.Control name="password" type="password" autoComplete="current-password" required />
        </Form.Group>
        <Button type="submit" disabled={pending} size="lg">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        {allowRegistration && (
          <p className="text-center mb-0 small text-secondary">
            No account yet? <Link href="/register">Create one</Link>
          </p>
        )}
      </Form>
    </div>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  return (
    <Form action={action} className="d-grid gap-3">
      {state.error && <Alert variant="danger" className="mb-0">{state.error}</Alert>}
      <Form.Group controlId="reg-name">
        <Form.Label>Name <span className="text-secondary fw-normal">(optional)</span></Form.Label>
        <Form.Control name="name" type="text" autoComplete="name" />
      </Form.Group>
      <Form.Group controlId="reg-email">
        <Form.Label>Email</Form.Label>
        <Form.Control name="email" type="email" autoComplete="email" required />
      </Form.Group>
      <Form.Group controlId="reg-password">
        <Form.Label>Password</Form.Label>
        <Form.Control name="password" type="password" autoComplete="new-password" required minLength={8} />
        <Form.Text className="text-secondary">At least 8 characters.</Form.Text>
      </Form.Group>
      <Button type="submit" disabled={pending} size="lg">
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center mb-0 small text-secondary">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </Form>
  );
}
