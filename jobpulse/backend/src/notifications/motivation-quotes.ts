/*
handles motivational quote generations used for notifications

what it does:
    - generate short motivational quote using gemini
    - adjust tone based on time of the day
    - uses user's progress data for quotes
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


//backup quotes if ai fail
const fallbackQuotes: Record<QuoteTone, string> = {

    night: "Every application you send is a step forward. Rest up.",
    morning: "The best time to apply is right now. Make it count.",
    afternoon: "The clock is moving. So should you.",
    evening: "The day isn't over. Neither are you.",

};


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

    if (!(tone in fallbackQuotes)) {
        throw new Error(`Invalid quote tone: ${tone}`);
    }

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


/*
it handles the creation of ai generated quotes
*/

async function generateQuoteWithGemini(
    
    tone: QuoteTone,
    context?: {
        appliedToday?: number;
        effectiveTarget?: number;
    }
): Promise<string> {

    //use the users' no of jobs applied data to aid ai on the context
    let situationLine = "";

    if (context?.appliedToday !== undefined && context?.effectiveTarget !== undefined) {

        const remaining = Math.max(0, context.effectiveTarget - context.appliedToday);
        const progressPct = context.effectiveTarget > 0 ? Math.round(
            (context.appliedToday / context.effectiveTarget) * 100
        ): 0;

        situationLine = `
            The person has applied to ${context.appliedToday}
            out of their ${context.effectiveTarget} target jobs today
            (${progressPct}% done, ${remaining} remaining).
            Reference these numbers naturally if it makes the
            quote more powerful — but only if it feels organic, not forced.`;
    }

    //build final ai prompt
    const prompt = `
        You are writing a short motivational push notification quote for a job seeker.

        Context about the moment:
        ${toneContext[tone]}
        ${situationLine}

        Rules:
        - Write exactly ONE quote. No alternatives, no options.
        - Maximum 25 words. Shorter is better — this appears in a phone notification.
        - Do NOT use hashtags, bullet points, quotation marks, or any formatting.
        - Do NOT start with "I" or address the reader as "you" repeatedly.
        - Do NOT be generic — make it feel personal and real for this exact moment.
        - Do NOT include any explanation or preamble — output only the quote itself.
        - Vary the style: sometimes declarative, sometimes a command, sometimes a question.

        Write the quote now:
    `;

    //call gemini api
    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawText = response.text();

    //clean the ai output
    const cleaned = rawText
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/\n+/g, " ")
        .trim();

    //validate response
    if (!cleaned || cleaned.length < 5){
        throw new Error("the quote gemini returned is either too short or null")
    }

    //set word limit
    const words = cleaned.split(/\s+/);

    if (words.length > 25) {
        const firstSentence = cleaned.split(/[.!?]/)[0];
        return firstSentence.trim() || words.slice(0, 25).join(" ");
    }


    return cleaned;
}