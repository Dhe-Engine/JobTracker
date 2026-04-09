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