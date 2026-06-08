"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
exports.getGoogleAuthUrl = getGoogleAuthUrl;
exports.handleGooglecallback = handleGooglecallback;
exports.verifySessionToken = verifySessionToken;
exports.getGmailClientForUser = getGmailClientForUser;
const google_auth_library_1 = require("google-auth-library");
const googleapis_1 = require("googleapis");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto")); //built into node - no install needed
const config_1 = require("../core/config");
const client_1 = require("../db/client");
/*
google oauth client

it handles the oauth handshake with google to:
    - generate consent urls
    - exchange authorization codes for tokens
    - fetch user profile data
*/
const OAuthClient = new google_auth_library_1.OAuth2Client(config_1.config.google.clientId, config_1.config.google.clientSecret, config_1.config.google.redirectUri);
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
function encryptToken(plaintext) {
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, Buffer.from(config_1.config.encryption.key), iv);
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
function decryptToken(stored) {
    const [ivHex, authTagHex, encrypted] = stored.split(":");
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, Buffer.from(config_1.config.encryption.key), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}
/*
oauth flow: step 1 - generate consent url

redirects user to google oauth screen
key flags:
    - access_type = offline -> to ensure refresh_token is issued
    - prompt = consent -> forces refresh_token on repeated logins
*/
function getGoogleAuthUrl() {
    return OAuthClient.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [...config_1.config.google.scopes],
    });
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
async function handleGooglecallback(code) {
    const { tokens } = await OAuthClient.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
        //refresh token is important for long time access
        throw new Error("Missing required oauth tokens");
    }
    OAuthClient.setCredentials(tokens);
    //retrieve authenticated user profile
    const oauth = googleapis_1.google.oauth2({ version: "v2", auth: OAuthClient });
    const { data: googleUser } = await oauth.userinfo.get();
    if (!googleUser.id || !googleUser.email) {
        throw new Error("invalid google user profile response");
    }
    //database upsert (user creation)
    const { data: user, error } = await client_1.db
        .from("users")
        .upsert({
        google_id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name ?? googleUser.email,
        avatar_url: googleUser.picture ?? null,
        //persist encrypted oauth credentials 
        gmail_token: encryptToken(JSON.stringify({
            access_token: tokens.access_token ?? "",
            refresh_token: tokens.refresh_token ?? "",
            expiry_data: tokens.expiry_date ?? 0,
        })),
        timezone: "UTC",
        notifications_enabled: true,
    }, {
        onConflict: "google_id", //ensure uniqueness at db level
        ignoreDuplicates: false, //enforce update on conflict
    })
        .select()
        .single();
    if (error || !user) {
        throw new Error(`user upsert failed: ${error?.message}`);
    }
    //issue application jwt (stateless session)
    const sessionToken = jsonwebtoken_1.default.sign({
        userId: user.id,
        email: user.email,
    }, config_1.config.jwt.secret, {
        expiresIn: config_1.config.jwt.expiresIn,
    });
    return { user, sessionToken };
}
/*
verify jwt session token

this function checks if a jwt is valid and returns the payload

its function:
    - used in auth middleware to protect requests
    - returns decoded payload(userid, email)
    - throws error if invalid or expired
*/
function verifySessionToken(token) {
    return jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
}
/*
gmail client for a user

returns an authenticated gmail oauth client for a user

responsibilities:
    1. feth and decrypt stored gmail tokens from the database
    2. create an oauth client with the user's information, ready to make gmail api calls
    3. automatically handle token refresh and updates db if expired
*/
async function getGmailClientForUser(userId) {
    const { data: user, error } = await client_1.db.from("users").
        select("gmail_token, timezone").
        eq("id", userId).
        single();
    if (error || !user?.gmail_token) {
        throw new Error("User has no connected gmail account");
    }
    const tokenData = JSON.parse(decryptToken(user.gmail_token));
    const userOauthClient = new google_auth_library_1.OAuth2Client(config_1.config.google.clientId, config_1.config.google.clientSecret, config_1.config.google.redirectUri);
    userOauthClient.setCredentials(tokenData);
    //listen for token refresh and save new tokens
    userOauthClient.on("tokens", async (newTokens) => {
        if (newTokens.access_token) {
            const updated = { ...tokenData, ...newTokens };
            await client_1.db
                .from("users")
                .update({ gmail_token: encryptToken(JSON.stringify(updated)) })
                .eq("id", userId);
        }
    });
    return { client: userOauthClient, timezone: user.timezone };
}
