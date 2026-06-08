"use strict";
/*
this file builds push notification messages

what it does:
    - creates notification titles and body text
    - adjusts messaging based on time of day
    - includes user progress in the message
    - defines notification frequency and threshold rules
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeNotification = composeNotification;
exports.getWindowForHour = getWindowForHour;
exports.getWindowFrequencyMinutes = getWindowFrequencyMinutes;
exports.getWindowThreshold = getWindowThreshold;
const motivation_quotes_1 = require("./motivation-quotes");
//builds a notification message
async function composeNotification(input) {
    const { window, appliedToday, effectiveTarget, hoursRemaining } = input;
    //calculate the number of application left
    const remaining = Math.max(0, effectiveTarget - appliedToday);
    //calculate progress percentage
    const progressPct = effectiveTarget > 0 ?
        Math.round((appliedToday / effectiveTarget) * 100) : 0;
    //fetch motivational quote for this time window
    const quote = await (0, motivation_quotes_1.getMotivationQuote)(window, {
        appliedToday: input.appliedToday,
        effectiveTarget: input.effectiveTarget,
    });
    let title;
    let body;
    //select message template based on time window
    switch (window) {
        case "night":
            title = "📋 Your goal for today";
            body = effectiveTarget > 0 ?
                `You're aiming for ${effectiveTarget} application${effectiveTarget !== 1 ? "s" : ""} today. ${quote}` :
                `Set a daily goal to get started. ${quote}`;
            break;
        case "morning":
            title = appliedToday === 0 ?
                "☀️ Time to get started" : `☀️ ${appliedToday} down, ${remaining} to go`;
            body = appliedToday === 0 ?
                `Your target is ${effectiveTarget} today. ${quote}` : `You're at ${progressPct}% of your goal. ${quote}`;
            break;
        case "afternoon":
            title = remaining === 0 ?
                "✅ Target hit — great work!" : `⚡ ${appliedToday}/${effectiveTarget} — ${remaining} still needed`;
            body = remaining === 0 ?
                "You've hit your target for today." :
                `It's midday. You need ${remaining} more application${remaining !== 1 ? "s" : ""}. ${quote}`;
            break;
        case "evening":
            const hoursStr = hoursRemaining <= 1 ?
                "less than an hour" : `${hoursRemaining} hour${hoursRemaining !== 1 ? "s" : ""}`;
            title = remaining === 0 ? "🔥 Target crushed today!" :
                `🔥 ${remaining} left — ${hoursStr} remaining`;
            body = remaining === 0 ?
                "You hit your goal. Rest well tonight." :
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
function getWindowForHour(hour) {
    if (hour >= 0 && hour < 6)
        return "night";
    if (hour >= 6 && hour < 12)
        return "morning";
    if (hour >= 12 && hour < 18)
        return "afternoon";
    return "evening";
}
// returns how often notifications is sent in each window
function getWindowFrequencyMinutes(window) {
    switch (window) {
        case "night":
            return 1440; //once per day
        case "morning":
            return 120; //every 2hrs
        case "afternoon":
            return 90; //every 90 mins
        case "evening":
            return 60; //every hr
    }
}
//returns the minimum progress before sending notifications
function getWindowThreshold(window) {
    switch (window) {
        case "night":
            return null;
        case "morning":
            return 0.25;
        case "afternoon":
            return 0.5;
        case "evening":
            return 0.8;
    }
}
