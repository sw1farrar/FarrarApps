import { NextResponse } from "next/server";
import {
  DEVICE_SESSION_OK_COOKIE,
} from "@/lib/auth/device-constants";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("fa_role", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(DEVICE_SESSION_OK_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
