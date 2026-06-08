"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("../core/config");
/*
supabase client

creates a strongly typed db client using generated db types
this ensures:
    - compile time validation of table or column names
    - safer queries with full typescript support

any mismatch between queries and actual schema will be flagged
during development instead of runtime
*/
exports.db = (0, supabase_js_1.createClient)(config_1.config.supabase.url, config_1.config.supabase.serviceKey, {
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
});
