"use server";

import { db } from "@/db";
import { user, UserType } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

export async function getMe(): Promise<UserType | null | undefined> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  const users = await db.select().from(user).where(eq(user.id, session.user.id));
  console.log(JSON.stringify(session, null, 2));
  console.log(JSON.stringify(users, null, 2));
  return users[0];
}
