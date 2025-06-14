import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// export const runtime = "nodejs"; // Next js uses Edge Runtime by default but Better Auth uses Nodejs Runtime for perf_hooks module. Hence required.

export const { POST, GET } = toNextJsHandler(auth);
