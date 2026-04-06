import { z } from "zod";

// z.object defines the "shape" we expect our environment variables to have.
// if any are missing when the server boots, it crashes immediately with a
// clear error which is better than a mysterious failure 10 requests later

// define strucutre for all environment variables used in the app
const envSchema = z.object(
    {   
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