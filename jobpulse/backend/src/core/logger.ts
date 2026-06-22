/*
This file creates a "smart console.log system" for the backend.

Instead of:
  console.log("user logged in")

We use:
  logger.info("user logged in", { userId: "abc" })

This produces structured logs that are:
  - searchable
  - filterable
  - readable by machines (JSON)
  - easier to debug in production (Railway, Docker, etc.)
*/

type LogLevel = "debug" | "info" | "warn" | "error";

/*
Each log entry is one "event".
*/
interface LogEntry {
  level: LogLevel;   // how important this message is
  msg: string;       // human-readable message
  ts: string;        // timestamp when it happened

  /*
  extra data attached to the log

  examples:
    userId, requestId, statusCode, duration, email, etc.
  */
  [key: string]: unknown;
}

/*
assign numbers to log levels so we can compare them.

Example:
  debug = 0
  info  = 1
  warn  = 2
  error = 3
*/
const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/*
Minimum log level that should be shown.

In production:
  - hide debug logs (too noisy)

In development:
  - show everything (for debugging)
*/
const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === "production" ? "info" : "debug";

/*
CORE LOG FUNCTION

This is the brain of the logging system.
Everything (info, warn, error) eventually uses this.
*/
function log(
  level: LogLevel,
  msg: string,
  context: Record<string, unknown> = {}
): void {
  /*
  Step 1: filter out low-importance logs
  */
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return;

  /*
  Step 2: build the log object

  This is the structured version of the log.
  */
  const entry: LogEntry = {
    level,
    msg,
    ts: new Date().toISOString(),

    /*
    Spread extra context directly into the log.

    This makes logs easy to search like:
      userId: "abc"
      status: 500
    */
    ...context,
  };

  /*
  Step 3: output format depends on environment
  */
  if (process.env.NODE_ENV === "production") {
    /*
    Production mode:
      - output pure JSON
      - logging systems can parse it automatically
    */
    console.log(JSON.stringify(entry));
  } else {
    /*
    Development mode:
      - human-friendly colored logs
      - easier to read in terminal
    */

    const colour = {
      debug: "\x1b[36m", // cyan
      info: "\x1b[32m",  // green
      warn: "\x1b[33m",  // yellow
      error: "\x1b[31m", // red
    }[level];

    const reset = "\x1b[0m";

    /*
    Convert extra context into a string for display
    */
    const ctxStr =
      Object.keys(context).length > 0
        ? " " + JSON.stringify(context)
        : "";

    console.log(`${colour}[${level.toUpperCase()}]${reset} ${msg}${ctxStr}`);
  }
}

/*
PUBLIC LOGGER API

This is what the rest of the backend uses.

Instead of calling `log()` directly,
we expose clean named functions:
*/
export const logger = {
  /*
  debug:
    - very detailed info
    - used only during development or deep debugging
  */
  debug: (msg: string, ctx?: Record<string, unknown>) =>
    log("debug", msg, ctx),

  /*
  info:
    - normal successful operations
    - example: "user logged in"
  */
  info: (msg: string, ctx?: Record<string, unknown>) =>
    log("info", msg, ctx),

  /*
  warn:
    - something unusual but not fatal
    - example: "slow request detected"
  */
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    log("warn", msg, ctx),

  /*
  error:
    - something failed
    - example: database error, API crash, etc.
  */
  error: (msg: string, ctx?: Record<string, unknown>) =>
    log("error", msg, ctx),
};
