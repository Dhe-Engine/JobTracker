/*
timezone utility 

automatically handles timezone offset and daylight saving

function:
    - provide consistent date/time based on user's location timezone
    - does not rely on server timezone
    - ensure the app behavior is in sync with timezone
*/


/*
getTodayinTimeZone function

returns current date in user's timezone

format:
    - dd-mm-yyyy
 */

export function getTodayinTimeZone(timezone: string): string {

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
export function getYesterdayInTimeZone(timeZone: string): string {

    //new date object for 'now'
    const yesterday = new Date()

    //subtract by one day
    yesterday.setDate(yesterday.getDate() - 1);

    //format result by user's timezone
    return new Intl.DateTimeFormat("sv-SE", {
        
        timeZone: timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",

    }).format(yesterday)
}