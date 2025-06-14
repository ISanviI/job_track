"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function checkSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  return !!session; // Convert session to boolean: true if session exists, false if null/undefined
} 