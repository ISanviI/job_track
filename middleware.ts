import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

import {
  apiAuthPrefix,
  authRoutes,
  DEFAULT_LOGIN_REDIRECT,
  publicRoutes,
} from "./src/routes";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  // const hasSession = request.cookies.has("better-auth.session-token");

  const isApiAuth = request.nextUrl.pathname.startsWith(apiAuthPrefix);

  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname);

  const isAuthRoute = () => {
    return authRoutes.some((path) => request.nextUrl.pathname.startsWith(path));
  };

  if (isApiAuth) {
    return NextResponse.next();
  }

  if (isAuthRoute()) {
    if (session) {
      return NextResponse.redirect(
        new URL(DEFAULT_LOGIN_REDIRECT, request.url),
      );
    }
    return NextResponse.next();
  }

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
} 