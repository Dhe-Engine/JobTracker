import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import crypto from "crypto"; //built into node - no install needed
import { config } from "../core/config";
import { db } from "../db/client";
import { oauth2 } from "googleapis/build/src/apis/oauth2";
import { email } from "zod";


/*
google oauth client

it handles the oauth handshake with google to:
    - generate consent urls
    - exchange authorization codes for tokens
    - fetch user profile data
*/

const OAuthClient = new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
)

//token encryption 

/*uses authentication encryption to ensure:
    - confidentiality that the data cannot be read without the key
    - integrity, tampering causes decryption failure
*/

//storage format: iv: authTag:cipherText (hex-coded)
const ALGORITHM = "aes-256-gcm";


/*
encrypt sensitive token payload before database persistence

security properties:
    - random iv to ensure non-deterministic ciphertext
    - auth tag guarantees tamper detection

 @param plaintext - JSON string containing OAuth tokens
 @returns serialized encrypted payload
*/
export function encryptToken(plaintext: string): string {
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(
        ALGORITHM,
        Buffer.from(config.encryption.key),
        iv
    );

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/*
decrypt token payload retrieved from storage

check if:
    - data is corrupted
    - auth tag validation fails (tampering detected)

@params stored - serialized encrypted payload
@returns decrypted plaintext string
*/

export function decryptToken(stored: string): string {
    const [ivHex, authTagHex, encrypted] = stored.split(":");

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(config.encryption.key),
        Buffer.from(ivHex, "hex")
    );

    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted
}

/*
oauth flow: step 1 - generate consent url

redirects user to google oauth screen
key flags:
    - access_type = offline -> to ensure refresh_token is issued
    - prompt = consent -> forces refresh_token on repeated logins
*/

export function getGoogleAuthUrl(): string {
    return OAuthClient.generateAuthUrl(
        {
            access_type: "offline",
            prompt: "consent",
            scope: [...config.google.scopes],
        }
    );
}

/* 
step 2: handle google oauth callback

handles the google oauth callback for login/signup

This function takes the one-time authorization code from Google,
completes the OAuth flow, and sets up the user session.

responsibilities:
    1. exchange authorization code for tokens
    2. fetch user google profile
    3. upsert user into database
    4. issue application jwt session
*/

export async function handleGooglecallback(code:string) {
    const { tokens } = await OAuthClient.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token){
        //refresh token is important for long time access
        throw new Error("Missing required oauth tokens");
    }

    OAuthClient.setCredentials(tokens);

    //retrieve authenticated user profile
    const oauth = google.oauth2({version:"v2", auth: OAuthClient});
    const { data: googleUser } = await oauth.userinfo.get();

    if(!googleUser.id || !googleUser.email) {
        throw new Error("invalid google user profile response");
    }

    //database upsert (user creation)
    const { data: user, error } = await db
        .from("users")
        .upsert(
            {
                google_id: googleUser.id,
                email: googleUser.email,
                name: googleUser.name ?? googleUser.email,
                avatar_url: googleUser.picture ?? null,

                //persist encrypted oauth credentials 
                gmail_token: encryptToken(
                    JSON.stringify(
                        {
                            access_token: tokens.access_token,
                            refresh_token: tokens.refresh_token,
                            expiry_data: tokens.expiry_date,
                        }
                    )
                ),

                timezone: "UTC",
                notifications_disabled: true,
            },
            {
                onConflict: "google_id", //ensure uniqueness at db level
                ignoreDuplicates: false, //enforce update on conflict
            }
        )
        .select()
        .single();

        if(error || !user) {
            throw new Error(`user upsert failed: ${error?.message}`);
        }

        //issue application jwt (stateless session)
        const sessionToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
            },
            config.jwt.secret,
            {
                expiresIn: config.jwt.expiresIn as jwt.SignOptions["expiresIn"],
            }
        );

        return {user, sessionToken};
}

