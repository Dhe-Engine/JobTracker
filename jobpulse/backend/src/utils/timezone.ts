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