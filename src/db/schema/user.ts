import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
// import { gender, userSchema, role } from ".";
import { dbSchema } from ".";
import { z } from "zod";

// Define the valid values as constants
export const GENDER_VALUES = ['male', 'female'] as const;
export const ROLE_VALUES = ['admin', 'member'] as const;

// export const user = userSchema.table("user", {
export const user = dbSchema.table("user", {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').$defaultFn(() => false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
  username: text('username').unique(),
  displayUsername: text('display_username'),
  gender: text('gender').$type<typeof GENDER_VALUES[number]>(),
  role: text('role').$type<typeof ROLE_VALUES[number]>().$defaultFn(() => 'member').notNull()
});

export type UserType = typeof user.$inferSelect;