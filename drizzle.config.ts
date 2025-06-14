import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // schemaFilter: ["public", "auth", "user", "app", process.env.DB_SCHEMA_NAME!],
  schemaFilter: [process.env.DB_SCHEMA_NAME!], // public - for pgEnums
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
  // Print all statements
  verbose: true,
  // Always ask for confirmation
  strict: true,
});
