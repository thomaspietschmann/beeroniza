// Client-side fetch wrapper for the internal JSON API. Centralizes the repeated
// "throw the server's { error } message on non-2xx" envelope so call sites don't
// each reimplement `res.json().catch(() => null)` + `data?.error ??`.

export interface ApiFetchOptions extends RequestInit {
  // Message thrown when the response has no { error } field.
  fallbackError?: string;
}

// Performs the request and, on a non-OK response, throws an Error carrying the
// server's `error` message (or `fallbackError`). On success, returns the parsed
// JSON body (or null for empty 204-style responses).
export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { fallbackError = "Something went wrong.", ...init } = options;
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? fallbackError);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// Convenience for JSON-body mutations (POST/PUT/PATCH/DELETE).
export function apiMutate<T = unknown>(
  url: string,
  method: string,
  body?: unknown,
  fallbackError?: string,
): Promise<T> {
  return apiFetch<T>(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    fallbackError,
  });
}
