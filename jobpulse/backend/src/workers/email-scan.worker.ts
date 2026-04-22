/*
this method processes incoming gmail webhooks asynchronously

fetches new emails and converts them into job applications

what to do:
    - consume jobs from redis queue
    - fetch new emails using historyId
    - prevent duplicate applications
    - classify emails using gemini
    - remove irrelevant or low confidence results
    - send valid job app to database
    - handle failure without breaking
*/

import {Worker, Queue} from "bullmq";
import { config } from "../core/config";
import { db } from "../db/client";
import { getNewEmails } from "../services/gmail.service";
import { classifyEmail } from "../services/email-parser.service";


/*
queue setup

this method sets up the email scan queue

configuration: 
    - retry failed jobs up to 3x
    - uses exponential backoff 2s -> 4s -> 8s
    - automatically clean completed and failed jobs after a period
*/
export const emailScanQueue = new Queue("email-scan", {

    connection: { url: config.redis.url },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        removeOnComplete: {age: 86400}, //24hrs
        removeOnFail: {age: 604800} //7days
    },
});

export const emailScanWorker = new Worker("email-scan", async (job) => {

    //this object process jobs from email scan queue object
    const  {userId, historyId} = job.data as {
        userId: string;
        historyId: string;
    };

    console.log(`[email-scan] processing job ${job.id} for user ${userId}`);

    //1.fetch new emails
    const newEmails = await getNewEmails(userId, historyId);

    if(newEmails.length === 0) {
        console.log(`[email-scan] no new emails for user ${userId}`);
        return;
    }

    //2. process each email sequentially to isolate errors 
    for (const email of newEmails){

        //check for duplicate
        const {count} = await db
            .from("applications")
            .select("id",{count:"exact",head:true})
            .eq("user_id",userId)
            .eq("email_id",email.gmail_message_id);

        if (count && count > 0){
            console.log(`[email-scan] skipping duplicate email ${email.gmail_message_id}`);
            continue;
        }

        //classify email using ai
        const classification = await classifyEmail(email);

        console.log(
            `[email-scan] Email "${email.subject}" → ` +
            `is_job_application: ${classification.is_job_application}, ` +
            `confidence: ${classification.confidence}`
        );

        //filter non-job emails
        if (!classification.is_job_application) {
            continue;
        }

        //filter low confidence results
        if (classification.confidence === "low"){
            console.log(`[email-scan] low confidence for "${email.subject}" - skipping`);
            continue;
        }

        //persist application
        const {error:insertError} = await db.from("applications").insert({

            user_id: userId,
            company: classification.company ?? extractCompanyFromSender(email.from),
            role: classification.role ?? "Unknown Role",
            status: "applied",
            source: "email_auto",
            email_id: email.gmail_message_id,
            applied_at: email.received_at,
        });

        if (insertError) {
            
            console.error(
                `[email-scan] failed to insert applicationn for email ${email.gmail_message_id}: `,
                insertError.message
            );
        }
        else {
            console.log(
                `[email-scan] saved application: ${classification.company} - ${classification.role}`
            );
        }
    }
},

//worker configuration to process multiple users in parallel
{
    connection: {url: config.redis.url},
    concurrency: 5,
}
);

/*
event listeners

used for debugging
*/
emailScanWorker.on("completed", (job) => {
    console.log(`[email-scan] job ${job.id} completed`);
});

emailScanWorker.on("failed", (job, err) => {
    console.error(`[email-scan] job ${job?.id} failed after all retries:`,
        err.message
    );
});


/*
a fallback mechanism for when ai cannot extract company's name

logic:
    - extract domain from email address
    - ignore ats domain
    - infer company from domain name
*/

const ATS_DOMAINS = new Set([
    "greenhouse.io",
    "lever.co",
    "workday.com",
    "myworkdayjobs.com",
    "taleo.net",
    "icims.com",
    "jobvite.com",
    "smartrecruiters.com",
    "bamboohr.com",
]);

function extractCompanyFromSender(from: string): string{

    //extract email address from "from" field
    const emailMatch = from.match(/<(.+)>/) ?? from.match(/(\S+@\S+)/);

    if (!emailMatch) return "Unknown company";

    const emailAddress = emailMatch[1];

    //extract domain
    const domain = emailAddress.split("@")[1]?.toLowerCase();
    if (!domain) return "Unknown company";

    //filter ats domains
    if (ATS_DOMAINS.has(domain)) return "Unknown company";

    //infer company name
    const parts = domain.split(".");
    const companyPart = parts.length >= 2 ? parts[parts.length -2] : parts[0];

    return companyPart.charAt(0).toUpperCase + companyPart.slice(1);

}


