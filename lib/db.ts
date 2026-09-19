import { neon } from "@neondatabase/serverless";

// Runs in the browser — browser fetch() can reach Neon HTTPS; sandbox server cannot.
export const sql = neon(process.env.NEXT_PUBLIC_DATABASE_URL!);
