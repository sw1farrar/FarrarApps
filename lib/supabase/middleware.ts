import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEVICE_SESSION_OK_COOKIE,
  DEVICE_TOKEN_COOKIE,
  DEVICE_TOKEN_MAX_AGE,
} from "@/lib/auth/device-constants";
import {
  parseSessionOkValue,
  sessionOkValue,
} from "@/lib/auth/device-session";

const ROLE_COOKIE = "fa_role";
const ROLE_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours
const ROLE_COOKIE_VALUES = ["owner", "staff", "client"] as const;

type RoleCookieValue = (typeof ROLE_COOKIE_VALUES)[number];

const PROTECTED_PATH_PREFIXES = [
  "/dashboard",
  "/portal",
  "/customers",
  "/projects",
  "/finance",
  "/invoices",
  "/transactions",
  "/reports",
  "/activity",
  "/settings",
  "/invoice-pdf",
];

const STATIC_ASSET_REGEX =
  /\.(?:avif|css|gif|ico|jpg|jpeg|js|json|map|mp4|png|svg|txt|webm|webp|woff|woff2)$/i;

function isStaticAssetPath(pathname: string) {
  return (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    STATIC_ASSET_REGEX.test(pathname)
  );
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isRoleCookieValue(value: string | undefined): value is RoleCookieValue {
  return ROLE_COOKIE_VALUES.includes(value as RoleCookieValue);
}

function withDeviceToken(request: NextRequest, response: NextResponse) {
  let token = request.cookies.get(DEVICE_TOKEN_COOKIE)?.value;
  if (!token) {
    token = crypto.randomUUID();
    response.cookies.set(DEVICE_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_TOKEN_MAX_AGE,
    });
  }
  return token;
}

function markSessionTrusted(
  response: NextResponse,
  userId: string,
  deviceToken: string,
  remembered: boolean
) {
  response.cookies.set(
    DEVICE_SESSION_OK_COOKIE,
    sessionOkValue(userId, deviceToken),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(remembered ? { maxAge: DEVICE_TOKEN_MAX_AGE } : {}),
    }
  );
}

async function deviceIsTrusted(
  supabase: ReturnType<typeof createServerClient>,
  request: NextRequest,
  response: NextResponse,
  userId: string,
  deviceToken: string
) {
  const sessionOk = request.cookies.get(DEVICE_SESSION_OK_COOKIE)?.value;
  if (sessionOk === sessionOkValue(userId, deviceToken)) {
    return true;
  }

  const { data } = await supabase
    .from("trusted_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_token", deviceToken)
    .maybeSingle();

  if (data?.id) {
    // Cache trust in a cookie so later navigations skip this DB round-trip.
    markSessionTrusted(response, userId, deviceToken, true);
    return true;
  }

  clearSessionOkCookie(response);
  return false;
}

async function getCachedRole(
  supabase: ReturnType<typeof createServerClient>,
  request: NextRequest,
  response: NextResponse,
  userId: string
) {
  const cached = request.cookies.get(ROLE_COOKIE)?.value;
  if (isRoleCookieValue(cached)) {
    return cached;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  const role = profile?.role as "owner" | "staff" | "client" | undefined;
  if (role) {
    response.cookies.set(ROLE_COOKIE, role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ROLE_COOKIE_MAX_AGE,
    });
  }
  return role ?? null;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
  if (isStaticAssetPath(pathname)) {
    return supabaseResponse;
  }

  const isVerifyRoute = pathname.startsWith("/login/verify");
  const isResetRoute = pathname.startsWith("/login/reset");
  const isAuthLanding = pathname === "/login" || pathname === "/";
  const isProtected = isProtectedPath(pathname);
  const shouldResolveUser =
    isProtected || isAuthLanding || isVerifyRoute || isResetRoute;
  const hasInviteParams =
    request.nextUrl.searchParams.has("portal_invite") ||
    request.nextUrl.searchParams.has("invite");
  // Server Actions POST to the current page; never redirect those or invite
  // accept hangs forever after sign-in (device not trusted yet).
  const isServerAction =
    request.method === "POST" &&
    (request.headers.has("next-action") ||
      request.headers.has("Next-Action"));

  if (!shouldResolveUser) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Warm soft-nav path: device-trust cookies already prove a prior full verify.
  // Prefer local getSession() (refresh only near expiry) over Auth /user RTT.
  const existingDeviceToken = request.cookies.get(DEVICE_TOKEN_COOKIE)?.value;
  const parsedSessionOk = parseSessionOkValue(
    request.cookies.get(DEVICE_SESSION_OK_COOKIE)?.value
  );
  const warmTrusted =
    isProtected &&
    !isAuthLanding &&
    !isVerifyRoute &&
    Boolean(existingDeviceToken) &&
    Boolean(parsedSessionOk) &&
    parsedSessionOk!.deviceToken === existingDeviceToken;

  if (warmTrusted) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const warmUser = session?.user;
    if (warmUser && warmUser.id === parsedSessionOk!.userId) {
      const cachedRole = request.cookies.get(ROLE_COOKIE)?.value;
      const role = isRoleCookieValue(cachedRole)
        ? cachedRole
        : await getCachedRole(
            supabase,
            request,
            supabaseResponse,
            warmUser.id
          );

      if (pathname.startsWith("/dashboard") && role === "client") {
        const url = request.nextUrl.clone();
        url.pathname = "/portal";
        url.search = "";
        const redirect = NextResponse.redirect(url);
        copyDeviceCookie(supabaseResponse, redirect);
        copyRoleCookie(supabaseResponse, redirect);
        copySessionOkCookie(supabaseResponse, redirect);
        return redirect;
      }

      if (
        pathname.startsWith("/portal") &&
        (role === "owner" || role === "staff")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        const redirect = NextResponse.redirect(url);
        copyDeviceCookie(supabaseResponse, redirect);
        copyRoleCookie(supabaseResponse, redirect);
        copySessionOkCookie(supabaseResponse, redirect);
        return redirect;
      }

      return supabaseResponse;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.search = "";
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    clearAuthCacheCookies(redirect);
    return redirect;
  }

  if (!user) {
    clearAuthCacheCookies(supabaseResponse);
    return supabaseResponse;
  }

  const deviceToken = withDeviceToken(request, supabaseResponse);
  let trusted = false;
  trusted = await deviceIsTrusted(
    supabase,
    request,
    supabaseResponse,
    user.id,
    deviceToken
  );

  if (!trusted && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login/verify";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    copyDeviceCookie(supabaseResponse, redirect);
    clearAuthCacheCookies(redirect);
    return redirect;
  }

  if (
    trusted &&
    (isAuthLanding || isVerifyRoute) &&
    !isServerAction
  ) {
    // Don't yank someone off an invite accept / verify form mid-flow.
    if (!(isAuthLanding && hasInviteParams)) {
      const role = await getCachedRole(
        supabase,
        request,
        supabaseResponse,
        user.id
      );
      const nextParam = request.nextUrl.searchParams.get("next");
      const safeNext =
        nextParam &&
        nextParam.startsWith("/") &&
        !nextParam.startsWith("//") &&
        nextParam !== "/login" &&
        !nextParam.startsWith("/login/")
          ? nextParam
          : null;
      const url = request.nextUrl.clone();
      url.search = "";
      if (role === "client") {
        url.pathname = "/portal";
      } else if (safeNext && !safeNext.startsWith("/portal")) {
        url.pathname = safeNext;
      } else {
        url.pathname = "/dashboard";
      }
      const redirect = NextResponse.redirect(url);
      copyDeviceCookie(supabaseResponse, redirect);
      copyRoleCookie(supabaseResponse, redirect);
      copySessionOkCookie(supabaseResponse, redirect);
      return redirect;
    }
  }

  if (!trusted && isAuthLanding && !isServerAction && !hasInviteParams) {
    const url = request.nextUrl.clone();
    url.pathname = "/login/verify";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    copyDeviceCookie(supabaseResponse, redirect);
    clearAuthCacheCookies(redirect);
    return redirect;
  }

  if (trusted && pathname.startsWith("/dashboard")) {
    const role = await getCachedRole(
      supabase,
      request,
      supabaseResponse,
      user.id
    );
    if (role === "client") {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      url.search = "";
      const redirect = NextResponse.redirect(url);
      copyDeviceCookie(supabaseResponse, redirect);
      copyRoleCookie(supabaseResponse, redirect);
      copySessionOkCookie(supabaseResponse, redirect);
      return redirect;
    }
  }

  if (trusted && pathname.startsWith("/portal")) {
    const role = await getCachedRole(
      supabase,
      request,
      supabaseResponse,
      user.id
    );
    if (role === "owner" || role === "staff") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      const redirect = NextResponse.redirect(url);
      copyDeviceCookie(supabaseResponse, redirect);
      copyRoleCookie(supabaseResponse, redirect);
      copySessionOkCookie(supabaseResponse, redirect);
      return redirect;
    }
  }

  return supabaseResponse;
}

function copyDeviceCookie(from: NextResponse, to: NextResponse) {
  const setCookie = from.cookies.get(DEVICE_TOKEN_COOKIE);
  if (setCookie) {
    to.cookies.set(DEVICE_TOKEN_COOKIE, setCookie.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_TOKEN_MAX_AGE,
    });
  }
}

function copyRoleCookie(from: NextResponse, to: NextResponse) {
  const role = from.cookies.get(ROLE_COOKIE);
  if (role) {
    to.cookies.set(ROLE_COOKIE, role.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ROLE_COOKIE_MAX_AGE,
    });
  }
}

function copySessionOkCookie(from: NextResponse, to: NextResponse) {
  const ok = from.cookies.get(DEVICE_SESSION_OK_COOKIE);
  if (ok) {
    to.cookies.set(DEVICE_SESSION_OK_COOKIE, ok.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_TOKEN_MAX_AGE,
    });
  }
}

function clearAuthCacheCookies(response: NextResponse) {
  response.cookies.set(ROLE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  clearSessionOkCookie(response);
}

function clearSessionOkCookie(response: NextResponse) {
  response.cookies.set(DEVICE_SESSION_OK_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
