import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEVICE_SESSION_OK_COOKIE,
  DEVICE_TOKEN_COOKIE,
  DEVICE_TOKEN_MAX_AGE,
} from "@/lib/auth/device-constants";
import { sessionOkValue } from "@/lib/auth/device-session";

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

async function deviceIsTrusted(
  supabase: ReturnType<typeof createServerClient>,
  request: NextRequest,
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

  return Boolean(data?.id);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const deviceToken = withDeviceToken(request, supabaseResponse);
  const pathname = request.nextUrl.pathname;
  const isVerifyRoute = pathname.startsWith("/login/verify");
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/auth");
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/invoice-pdf");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    // preserve device token cookie if we just set it
    const setCookie = supabaseResponse.cookies.get(DEVICE_TOKEN_COOKIE);
    if (setCookie) {
      redirect.cookies.set(DEVICE_TOKEN_COOKIE, setCookie.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: DEVICE_TOKEN_MAX_AGE,
      });
    }
    return redirect;
  }

  let trusted = false;
  if (user) {
    trusted = await deviceIsTrusted(supabase, request, user.id, deviceToken);
  }

  if (user && !trusted && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login/verify";
    const redirect = NextResponse.redirect(url);
    copyDeviceCookie(supabaseResponse, redirect);
    return redirect;
  }

  if (user && trusted && (pathname === "/login" || pathname === "/" || isVerifyRoute)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname =
      profile?.role === "client" ? "/portal" : "/dashboard";
    const redirect = NextResponse.redirect(url);
    copyDeviceCookie(supabaseResponse, redirect);
    return redirect;
  }

  if (user && !trusted && (pathname === "/login" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login/verify";
    const redirect = NextResponse.redirect(url);
    copyDeviceCookie(supabaseResponse, redirect);
    return redirect;
  }

  if (user && trusted && pathname.startsWith("/dashboard")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "client") {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      const redirect = NextResponse.redirect(url);
      copyDeviceCookie(supabaseResponse, redirect);
      return redirect;
    }
  }

  if (user && trusted && pathname.startsWith("/portal")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "owner" || profile?.role === "staff") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const redirect = NextResponse.redirect(url);
      copyDeviceCookie(supabaseResponse, redirect);
      return redirect;
    }
  }

  void isAuthRoute;
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
