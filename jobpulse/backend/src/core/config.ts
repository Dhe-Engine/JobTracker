import { z } from "zod";

/**
 * Environment Configuration Schema
 *
 * Defines and validates all required environment variables at application startup.
 * If validation fails, the app crashes early with a clear error message.
 *
 * This avoids runtime failures caused by missing or invalid configuration.
 */
const envSchema = z.object(
    {   
        //application environment

        //set the mode the app is running, if not provided default to development
        NODE_ENV: z.enum(["development","production","test"]).default("development"),

        //server port 
        PORT: z.string().default("3001"),

        //google oauth for login, retrieve from google cloud console
        GOOGLE_CLIENT_ID: z.string(), //app client id
        GOOGLE_CLIENT_SECRET: z.string(), //app secret key
        GOOGLE_REDIRECT_URI: z.string(), //url google redirects after login

        //json settings
        JWT_SECRET: z.string().min(32), //jwt (long random secret string)
        JWT_EXPIRES_IN: z.string().default("7d"), //period the token is valid i.e 7 days

        //encryption key for aes encryption
        ENCRYPTION_KEY: z.string().length(32), //aes encryption must be 32 characters

        //supabase (database + backend service)
        SUPABASE_URL: z.string().url(), //url of supabaser project
        SUPABASE_SERVICE_KEY: z.string(), // use the service role key on the backend

        //reddis for caching, sessions, queues
        REDIS_URL: z.string().default("redis://localhost:6379"), //points to local redis server

        //ai feature (claude)
        ANTHROPIC_API_KEY: z.string(), //api key to access anthropic

        //firebase cloud messaging for notifications
        FCM_PROJECT_ID: z.string(), //firebase id
        FCM_SERVICE_ACCOUNT_KEY: z.string(), //json string of the service account

        //frontend url (for redirect after login)
        FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    }
);

/*
parse and validate environment variables
throws immediately if validation fails
*/
const env = envSchema.parse(process.env);

/*
centralized application configuration object
transforms raw env variables into a structured config used in the app
*/
export const config = {
    env: env.NODE_ENV,

    // convert port to number once, instead of parsing repeatedly
    port: parseInt(env.PORT),

    // google auth config
    google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: env.GOOGLE_REDIRECT_URI,

        //these are the exact oauth scopes we request from google
        //"openid profile email" gives us the user's name and email
        //the gmail scope gives us read-only inbox access
        scopes: [
            "openid",
            "profile",
            "email",
            "https://www.googleapis.com/auth/gmail.readonly",
        ],
    },

    // jwt config
    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_EXPIRES_IN,
    },

    // encryption config
     encryption:{
        key: env.ENCRYPTION_KEY
     },

     // supabase config
     supabase: {
        url: env.SUPABASE_URL,
        serviceKey: env.SUPABASE_SERVICE_KEY,
     },


     // redis config 
     redis:{
        url: env.REDIS_URL,
     },
    
     //anthropic / claude
     anthropic: {
        apiKey: env.ANTHROPIC_API_KEY,
        //haiku is fast and cheap - perfect for email classification
        model: "claude-haiku-4-5-20251001",
     },

     //firebase messaging
     fcm: {
        projectId: env.FCM_PROJECT_ID,
        serviceAccountKey: JSON.parse(env.FCM_SERVICE_ACCOUNT_KEY),
     },

     //business rule constants (from phase 2)
      rules: {
        carryoverCapMultiplier: 2, //br-03: missed apps carry over up to 2x base target
        notificationCronSchedule: "*/5 * * * *", //every 15 mins
        dailySummaryCronSchedule: "0 0 * * *", //midnight everyday
      },

      //frontend integration
      frontend: {
        url: env.FRONTEND_URL,
      },

} as const; //"as const makes all values readonly - prevents accidental mutation"
