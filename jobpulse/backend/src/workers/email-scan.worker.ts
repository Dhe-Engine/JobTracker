/*
this method process incoming gmail webhooks asynchronously

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


export const emailScanQueue = new Queue("email-scan", {
/*
queue setup

this method setup the email scan queue

configuration: 
    - retry failed jobs up to 3x
    - uses exponential backoff 2s -> 4s -> 8s
    - automatically clean completed and failed jobs after a period
*/

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





