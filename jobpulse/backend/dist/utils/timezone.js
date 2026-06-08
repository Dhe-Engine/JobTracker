"use strict";
/*
timezone utility

automatically handles timezone offset and daylight saving

function:
    - provide consistent date/time based on user's location timezone
    - does not rely on server timezone
    - ensure the app behavior is in sync with timezone
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayinTimeZone = getTodayinTimeZone;
exports.getYesterdayInTimeZone = getYesterdayInTimeZone;
exports.getCurrentHourInTimeZone = getCurrentHourInTimeZone;
/*
getTodayinTimeZone function

returns current date in user's timezone

format:
    - dd-mm-yyyy
 */
function getTodayinTimeZone(timezone) {
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}
/*
getYesterdayInTimeZone

return yesterday's date in the user's timezone

function:
    - to calculate uncompleted target from the previous day
    - for previous day analytics
*/
function getYesterdayInTimeZone(timeZone) {
    //new date object for 'now'
    const yesterday = new Date();
    //subtract by one day
    yesterday.setDate(yesterday.getDate() - 1);
    //format result by user's timezone
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(yesterday);
}
/**
 getCurrentHourInTimeZone

 returns the current hour 0-23 based on the user's timezone

 purpose:
    - to determine morning, afternoon and schedule notifications
 */
function getCurrentHourInTimeZone(timezone) {
    //get hour as string (24 hour format)
    const hourStr = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
    }).format(new Date());
    //convert string to number
    return parseInt(hourStr, 10);
}
