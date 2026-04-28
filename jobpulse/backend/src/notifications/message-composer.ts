/*
this file builds push notification messages

what it does:
    - creates notification titles and body text
    - adjusts messaging based on time of day
    - includes user progress in the message
    - defines notification frequency and threshold rules
*/


import { getMotivationQuote, type QuoteTone } from "./motivation-quotes";


//defines the shape of the notification
export interface NotificationMessage {

    title: string;
    body: string;

    //extra data sent with notification
    data: {
        type: "goal_reminder";
        url: string;
    };
}

//the parameters for building a notification
export interface ComposeInput {
    window: "night" | "morning" | "afternoon" | "evening";
    appliedToday: number;
    effectiveTarget: number;
    hoursRemaining: number;
}

//builds a notification message
export function composeNotification(input: ComposeInput): NotificationMessage {

    const {window, appliedToday, effectiveTarget, hoursRemaining} = input;

    //calculate the number of application left
    const remaining = Math.max(0, effectiveTarget - appliedToday)

    //calculate progress percentage
    const progressPct = effectiveTarget > 0 ? 
        Math.round((appliedToday/effectiveTarget) * 100): 0;


    //fetch motivational quote for this time window
    const quote = getMotivationQuote(window as QuoteTone);

    let title: string;
    let body: string;

    //select message template based on time window
    switch(window) {

        case "night":

            title = "📋 Your goal for today";
            body = effectiveTarget > 0 ?
                `You're aiming for ${effectiveTarget} application${effectiveTarget !== 1 ? "s" : ""} today. ${quote}`: 
                `Set a daily goal to get started. ${quote}`;

            break;

        case "morning":

            title = appliedToday === 0 ?
                "☀️ Time to get started" : `☀️ ${appliedToday} down, ${remaining} to go`;
            body = appliedToday === 0 ? 
                `Your target is ${effectiveTarget} today. ${quote}`: `You're at ${progressPct}% of your goal. ${quote}`;

            break;

        case "afternoon":
            
            title = remaining === 0 ? 
                "✅ Target hit — great work!" : `⚡ ${appliedToday}/${effectiveTarget} — ${remaining} still needed`;
            body = remaining === 0 ?
                "You've hit your target for today.": 
                `It's midday. You need ${remaining} more application${remaining !== 1 ? "s" : ""}. ${quote}`;

            break;

        case "evening":

            const hoursStr = hoursRemaining <= 1? 
                "less than an hour" : `${hoursRemaining} hour${hoursRemaining !== 1 ? "s" : ""}`;

            title = remaining === 0 ? "🔥 Target crushed today!": 
                `🔥 ${remaining} left — ${hoursStr} remaining`;
            body = remaining === 0 ? 
                "You hit your goal. Rest well tonight.": 
                `${appliedToday} done, ${remaining} to go. ${hoursStr} left in your day. ${quote}`;

            break;
    }

    //return final notification object
    return {
        title,
        body,
        data: {
            type: "goal_reminder",
            url: "/dashboard",
        },
    };
}


/*
converts an hour into a notification window

i.e.:
    7 - morning
    14 - afternoon
*/
export function getWindowForHour(
    hour: number
): "night" | "morning" | "afternoon" | "evening" {

    if (hour >= 0 && hour < 6) return "night";
    if (hour >= 6 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "afternoon";
    return "evening"
}

