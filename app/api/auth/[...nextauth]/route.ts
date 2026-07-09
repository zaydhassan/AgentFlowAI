// Auth.js v5 catch-all route handler. Re-exports GET/POST from auth.ts.
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
