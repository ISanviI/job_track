import { db } from "@/db";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [username(), nextCookies()],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      prompt: "select_account+consent",
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
