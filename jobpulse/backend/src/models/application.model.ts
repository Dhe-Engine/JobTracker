/*
standardizes how application data flows across the system


what it does:
    - represent stored app records
    - define valid app states and sources
    - structure parsed email output from AI classification
    - define raw email metadata collected from Gmail
*/


//lifecyle state of job application
export type ApplicationStatus = 
    | "applied"
    | "interview"
    | "offer"
    | "rejected";


//represents application creation
export type ApplicationSource = "email_auto" | "manual";

export interface Application {
    /**
    database representation

    fields:
    - email_id is nullable because manual entries do not come from Gmail
    - applied_at represents when the application was sent (not when stored)
     */

    id: string;
    user_id: string;
    company: string;
    role: string;
    status: ApplicationStatus;
    source: ApplicationSource;

    email_id: string | null;
    applied_at: string;
    created_at:string;
}

export interface ParsedEmail {
    
    //represents the result returned by claude after annalyzing email
    
    is_job_application: boolean;
    company: string | null;
    role: string | null;
    confidence: "high" | "medium" | "low";
}


export interface EmailMetadata {

    //raw email metadata is the data extracted from gmail before ai processing
    gmail_message_id: string;
    subject: string;
    from: string;
    received_at: string;
    
}