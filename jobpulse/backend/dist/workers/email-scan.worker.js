"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailScanWorker = exports.emailScanQueue = void 0;
const bullmq_1 = require("bullmq");
const config_1 = require("../core/config");
const client_1 = require("../db/client");
const gmail_service_1 = require("../services/gmail.service");
const email_parser_service_1 = require("../services/email-parser.service");
const auth_service_1 = require("../services/auth.service");
const googleapis_1 = require("googleapis");
const logger_1 = require("../core/logger");
/*
queue setup

this method sets up the email scan queue

configuration:
    - retry failed jobs up to 3x
    - uses exponential backoff 2s -> 4s -> 8s
    - automatically clean completed and failed jobs after a period
*/
exports.emailScanQueue = new bullmq_1.Queue("email-scan", {
    connection: { url: config_1.config.redis.url },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        removeOnComplete: { age: 86400 }, //24hrs
        removeOnFail: { age: 604800 } //7days
    },
});
exports.emailScanWorker = new bullmq_1.Worker("email-scan", async (job) => {
    //this object process jobs from email scan queue object
    const { userId, historyId } = job.data;
    // console.log(`[email-scan] processing job ${job.id} for user ${userId}`);
    logger_1.logger.info("Email scan job processing", {
        jobId: job.id,
        userId,
    });
    const { client } = await (0, auth_service_1.getGmailClientForUser)(userId);
    logger_1.logger.debug("Gmail client initialized", {
        jobId: job.id,
        userId,
    });
    const gmail = googleapis_1.google.gmail({ version: "v1", auth: client });
    //1.fetch new emails
    const newEmails = await (0, gmail_service_1.getNewEmails)(userId, historyId);
    if (newEmails.length === 0) {
        // console.log(`[email-scan] no new emails for user ${userId}`);
        logger_1.logger.info("No new emails found", {
            jobId: job.id,
            userId,
        });
        return;
    }
    // console.log(
    //   `[email-scan] Found ${newEmails.length} new email(s) for user ${userId}`
    // );
    logger_1.logger.info("New Gmail messages found", {
        jobId: job.id,
        userId,
        emailCount: newEmails.length,
    });
    //2. process each email sequentially to isolate errors 
    for (const email of newEmails) {
        //check for duplicate
        const { count } = await client_1.db
            .from("applications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("email_id", email.gmail_message_id);
        if (count && count > 0) {
            // console.log(`[email-scan] skipping duplicate email ${email.gmail_message_id}`);
            logger_1.logger.debug("Skipping duplicate application email", {
                jobId: job.id,
                userId,
                gmailMessageId: email.gmail_message_id,
            });
            continue;
        }
        const fullEmail = await (0, gmail_service_1.fetchEmailFull)(gmail, email.gmail_message_id);
        if (!fullEmail) {
            // console.warn(`[email-scan] Could not fetch full email ${email.gmail_message_id}`);
            logger_1.logger.warn("Failed to fetch Gmail message", {
                jobId: job.id,
                userId,
                gmailMessageId: email.gmail_message_id,
            });
            continue;
        }
        //classify email using ai
        const classification = await (0, email_parser_service_1.classifyEmail)(fullEmail);
        logger_1.logger.info("Email classification completed", {
            jobId: job.id,
            userId,
            gmailMessageId: fullEmail.gmail_message_id,
            subject: fullEmail.subject,
            from: fullEmail.from,
            isJobApplication: classification.is_job_application,
            confidence: classification.confidence,
            company: classification.company,
            role: classification.role,
        });
        //filter non-job emails
        if (!classification.is_job_application) {
            // console.log(`[email-scan] Not a job application — skipping`);
            logger_1.logger.debug("Skipping non-job email", {
                jobId: job.id,
                userId,
                gmailMessageId: fullEmail.gmail_message_id,
            });
            continue;
        }
        //filter low confidence results
        if (classification.confidence === "low") {
            // console.log(`[email-scan] low confidence for "${email.subject}" - skipping` +
            //     `Consider checking if this is a valid application email.`
            // );
            logger_1.logger.info("Skipping low-confidence email classification", {
                jobId: job.id,
                userId,
                gmailMessageId: fullEmail.gmail_message_id,
                subject: fullEmail.subject,
                confidence: classification.confidence,
            });
            continue;
        }
        //Save to database 
        const company = classification.company ?? extractCompanyFromSender(fullEmail.from);
        //persist application
        const { error: insertError } = await client_1.db.from("applications").insert({
            user_id: userId,
            company,
            role: classification.role ?? "Unknown Role",
            status: "applied",
            source: "email_auto",
            email_id: fullEmail.gmail_message_id,
            applied_at: fullEmail.received_at,
        });
        if (insertError) {
            // console.error(
            //     `[email-scan] failed to insert applicationn for email ${email.gmail_message_id}: `,
            //     insertError.message
            // );
            logger_1.logger.error("Failed to save application", {
                jobId: job.id,
                userId,
                gmailMessageId: fullEmail.gmail_message_id,
                error: insertError.message,
            });
        }
        else {
            // console.log(
            //     `[email-scan]✅ saved application: ${classification.company} - ${classification.role}`
            // );
            logger_1.logger.info("Application saved", {
                jobId: job.id,
                userId,
                gmailMessageId: fullEmail.gmail_message_id,
                company,
                role: classification.role ?? "Unknown Role",
            });
        }
    }
}, 
//worker configuration to process multiple users in parallel
{
    connection: { url: config_1.config.redis.url },
    concurrency: 5,
});
/*
event listeners

used for debugging
*/
exports.emailScanWorker.on("completed", (job) => {
    // console.log(`[email-scan] job ${job.id} completed`);
    logger_1.logger.info("Email scan job completed", {
        jobId: job.id,
    });
});
exports.emailScanWorker.on("failed", (job, err) => {
    // console.error(`[email-scan] job ${job?.id} failed after all retries:`,
    //     err.message
    // );
    logger_1.logger.error("Email scan job failed", {
        jobId: job?.id,
        error: err.message,
        stack: err.stack,
    });
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
function extractCompanyFromSender(from) {
    //extract email address from "from" field
    const emailMatch = from.match(/<(.+)>/) ?? from.match(/(\S+@\S+)/);
    if (!emailMatch)
        return "Unknown company";
    const emailAddress = emailMatch[1];
    //extract domain
    const domain = emailAddress.split("@")[1]?.toLowerCase();
    if (!domain)
        return "Unknown company";
    //filter ats domains
    if (ATS_DOMAINS.has(domain))
        return "Unknown company";
    //infer company name
    const parts = domain.split(".");
    const companyPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
}
