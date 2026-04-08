import {createClient} from "@supabase/supabase-js";
import {config} from "../core/config";
import { Database} from "./types";

/*
supabase client

creates a strongly typed db client using generated db types
this ensures:
    - compile time validation of table or column names
    - safer queries with full typescript support

any mismatch between queries and actual schema will be flagged
during development instead of runtime
*/

export const db = createClient<Database>(
    config.supabase.url,
    config.supabase.serviceKey,
    {
        auth: { 
            /*
            auth strategy

            disable supabase's built in client handling because:
                - we manage auth ourselves manually 
                - server environment

            it prevents side effects like:
                - automatic token refresh
                - session storage
            */

            persistSession: false,
            autoRefreshToken: false,
        },
    }
);