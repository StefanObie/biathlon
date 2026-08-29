import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Disable prefetch — not supported in Supabase's "Transaction" pool mode.
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle({ client });
