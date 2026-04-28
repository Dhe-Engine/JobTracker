/*
handles motivational quote generations used for notifications

what it does:
    - generate short motivational quote using gemini
    - adjust tone based on time of the day
    - uses user progress data for quotes
    - use hardcode quotes if ai fail
*/


import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../core/config";


export type QuoteTone = "night" | "morning" | "afternoon" | "evening";

//gemini setup
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const model = genAI.getGenerativeModel({model: config.gemini.model});

const toneContext: Record<QuoteTone, string> = {
    night: `It is late at night or very early morning (midnight to 6am). 
        The person is a job seeker who has set a goal to apply to a certain 
        number of jobs today. This is a gentle reminder — they may be asleep. 
        The tone should be soft, reflective, and encouraging. Not pressuring.`,

    morning: `It is morning (6am to noon). The person is a job seeker starting 
        their day. They have a job application target to hit. The tone should be 
        energetic, optimistic, and forward-looking. Make them feel capable and 
        ready to take on the day.`,

    afternoon: `It is the afternoon (noon to 6pm). The person is a job seeker 
        who has not yet hit their daily application target. Half the day is gone. 
        The tone should be direct, urgent but not harsh, and motivating. Push them 
        to take action now while there is still time.`,

    evening: `It is evening (6pm to midnight). The person is a job seeker who 
        has not yet hit their daily application target. The day is nearly over. 
        The tone should be intense, honest, and driven. This is their last window 
        to act. Do not sugarcoat — be real with them about the urgency.`,
};


//backup quotes should ai fail
const fallbackQuotes: Record<QuoteTone, string> = {

    night: "Every application you send is a step forward. Rest up.",
    morning: "The best time to apply is right now. Make it count.",
    afternoon: "The clock is moving. So should you.",
    evening: "The day isn't over. Neither are you.",

}


/*
returns: 
    - generated ai quote
    - fallback/back up quotes should ai fail
*/

export async function getMotivationQuote(

    tone:  QuoteTone,
    context?: {
        appliedToday?: number;
        effectiveTarget?: number;
    }
): Promise<string> {

    try{
        const quote = await generateQuoteWithGemini(tone, context);
        return quote;
    }
    catch (err) {

        //backup quote when ai fails
        console.warn(
            `[motivation-quotes] gemini api failed for tone "${tone}", using fallback:`,
            err
        );
        return fallbackQuotes[tone];
    }
}