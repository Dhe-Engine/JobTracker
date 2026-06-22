
/*
REQUEST LOGGER MIDDLEWARE

This automatically logs every HTTP request.

It helps answer questions like:
  - who called this endpoint?
  - how long did it take?
  - did it fail?
*/

import { logger } from "./logger";
import { FastifyRequest, FastifyReply, LogLevel } from "fastify";


type Request = {
  method: string;
  url: string;
  user?: { userId: string };
};

type Reply = {
  statusCode: number;
};

export function createRequestLogger() {
  return function requestLogger(
    req: FastifyRequest,
    reply: FastifyReply,
    done: () => void
  ) {
    const start = Date.now();

    reply.raw.on("finish", () => {
      const duration = Date.now() - start;

      const level: LogLevel =
        reply.statusCode >= 500 ? "error"
        : reply.statusCode >= 400 ? "warn"
        : "info";

      logger[level](`${req.method} ${req.url}`, {
        status: reply.statusCode,
        duration: `${duration}ms`,
        userId: (req as any).user?.userId ?? "unauthenticated",
      });
    });
    done();
  };
}