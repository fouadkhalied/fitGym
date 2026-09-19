import { neon } from "@neondatabase/serverless";

// Runs in the browser — browser fetch() can reach Neon HTTPS; sandbox server cannot.
export const sql = process.env.DATABASE_URL
    ? neon(process.env.DATABASE_URL)
    : new Proxy(() => { }, {
        apply() {
            throw new Error("DATABASE_URL environment variable is not set. A valid database connection string MUST be provided.");
        },
        get() {
            throw new Error("DATABASE_URL environment variable is not set. A valid database connection string MUST be provided.");
        }
    }) as any;
