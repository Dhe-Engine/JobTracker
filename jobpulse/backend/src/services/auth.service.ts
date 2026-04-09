import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import crypto from "crypto"; //built into node - no install needed
import { config } from "../core/config";
import { db } from "../db/client";


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

    return `$ {iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
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
    const [ivHex, authTagHex, encrypted] = stored.split("");

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