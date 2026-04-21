/*
purpose:
    - send incoming emails metadata to claude ai for classification
    - check if an email is a job application confirmation
    - extract the data: company, role, confidence
*/


import {GoogleGenerativeAI} from "@google/generative-ai";
import {config} from "../core/config";
import type { EmailMetadata,ParsedEmail } from "../models/application.model";
import { resolve } from "node:dns";


//initialize google client
const genAI = new GoogleGenerativeAI(config.google.apiKey);

//ai model
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash"
})

//system prompt to define how claude behaves
const CLASSIFICATION_SYSTEM_PROMPT = 
`
You are an email classifier for a job application tracking email.

A job application confirmation email is one sent to a job seeker AFTER an application submission

It does the following:
- Confirms receipt of the application
- Comes from a company's HR system, ATS(e.g. Workday, Greenhouse, Lever), or careers team
- Contains phrases like "thank you for applying", "we received your application", "your application has been submitted", "application confirmation"

It is NOT a job application confirmation if it is:
- A job alert or newsletter
- A recruiter cold-outreach
- An interview invitation (that comes after confirmation)
- A rejection email
- Any promotional email

Respond with ONLY a JSON object - no explanation, no markdown, no code fences
The JSON must have exactly these four fields:

{
  "is_job_application": boolean,
  "company": string or null,
  "role": string or null,
  "confidence": "high" or "medium" or "low"
}

Rules for extraction:
- "company": Extract the hiring company name. Not the ATS provider (not "Workday" or "Greenhouse"). If unclear, return null.
- "role": Extract the job title the person applied for. If not mentioned, return null.
- "confidence": Use "high" if you are certain, "medium" if probable, "low" if guessing.`;

export async function classifyEmail(
    email: EmailMetadata
): Promise<ParsedEmail> {

    /*
    classify email using gemini

    flow:
        1. build email prompt
        2. call ai api
        3. extract raw text
        4. convert to json
    */

    //construct user message
    const prompt = `${CLASSIFICATION_SYSTEM_PROMPT} Subject: ${email.subject} From: ${email.from}`;

    try {

        //call gemini api
        const result = await model.generateContent(prompt);

        //extract raw text
        const rawText = result.response.text();

        //json format
        return parseGeminiResponse(rawText);

    } catch (err) {

        //safe fallback should api fail
        console.error("gemini classification failed:", err);

        return {
            is_job_application: false,
            company: null,
            role: null,
            confidence: "low"
        }
    } 
}

function parseGeminiResponse(rawText: string): ParsedEmail{

    /*
    parse and validate gemini response

    - remove formatting artifacts(markdown)
    - safely parse json
    - validate structure
    - normalize invalid or missing values
    */

    //clean text
    const cleaned = rawText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

    let parsed: unknown;

    //parse json
    try {
        parsed = JSON.parse(cleaned);
    }
    catch{
        console.error("failed to parse gemini json:", rawText);

        return {
            is_job_application: false,
            company: null,
            role: null,
            confidence: "low",
        };
    }

    //validate structure
    if (typeof parsed !== "object" || 
        parsed === null ||
        typeof (parsed as Record<string, unknown>).is_job_application !== "boolean"
    ){
        console.error("gemini response missing required fields:", parsed);

        return {
            is_job_application: false,
            company: null,
            role: null, 
            confidence: "low",
        };
    }

    const result = parsed as Record<string, unknown>;

    //normalize output
    return {

        is_job_application: result.is_job_application as boolean,
        company: typeof result.company === "string" ? result.company : null,
        role: typeof result.role === "string" ? result.role : null,
        confidence: result.confidence === "high" || result.confidence === "medium" ? result.confidence : "low",
    };
}

export async function classifyEmailBatch(
    emails: EmailMetadata[]
): Promise<Array<{email: EmailMetadata; result: ParsedEmail}>> {

    /*
    classifies multiple emails sequentially

    flow:
        - loop through emails
        - classify each email
        - store result
        - use of delay between requests
    */

    const results: Array<{email: EmailMetadata; result: ParsedEmail}> = [];

    for (const email of emails) {

        const result = await classifyEmail(email);

        results.push({email, result});

        //delay requests
        await new Promise((resolve) => setTimeout(resolve, 150));
    }

    return results
}


