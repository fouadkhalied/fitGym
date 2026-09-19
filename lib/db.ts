import { neon } from "@neondatabase/serverless";

// Runs in the browser — browser fetch() can reach Neon HTTPS; sandbox server cannot.
export const sql = process.env.NEXT_PUBLIC_DATABASE_URL
    ? neon(process.env.NEXT_PUBLIC_DATABASE_URL)
    : new Proxy(() => { }, {
        apply() {
            return Promise.reject(new Error("NEXT_PUBLIC_DATABASE_URL environment variable is not set. A valid database connection string MUST be provided."));
        },
        get() {
            return () => Promise.reject(new Error("NEXT_PUBLIC_DATABASE_URL environment variable is not set. A valid database connection string MUST be provided."));
        }
    }) as any;
