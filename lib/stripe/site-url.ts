import "server-only";

/**
 * Canonical site origin for Stripe success/cancel URLs.
 * Never trust request Origin (open-redirect risk).
 */
export function getCheckoutOrigin():
  | { ok: true; origin: string }
  | { ok: false; error: string } {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error: "NEXT_PUBLIC_SITE_URL is required in production",
      };
    }
    return { ok: true, origin: "http://localhost:3000" };
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "NEXT_PUBLIC_SITE_URL must be http(s)" };
    }
    return { ok: true, origin: url.origin };
  } catch {
    return { ok: false, error: "NEXT_PUBLIC_SITE_URL is invalid" };
  }
}
