/*
purpose:
    - send incoming emails metadata to claude ai for classification
    - check if an email is a job application confirmation
    - extract the data: company, role, confidence
*/


import {GoogleGenerativeAI} from "@google/generative-ai";
import {config} from "../core/config";
import type { EmailMetadata,ParsedEmail } from "../models/application.model";


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

