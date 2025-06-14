import { pgSchema } from "drizzle-orm/pg-core";

export const dbSchema = pgSchema(process.env.DB_SCHEMA_NAME!);

// Define different schemas for different purposes
// export const authSchema = pgSchema("auth"); // For authentication related tables
// export const userSchema = pgSchema("user"); // For user related tables
// export const appSchema = pgSchema("app"); // For application specific tables

// You can also use environment variables for schema names
// export const customSchema = pgSchema(process.env.DB_SCHEMA_NAME!);