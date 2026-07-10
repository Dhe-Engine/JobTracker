// backend/src/core/error-handler.ts

// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES
// Registers global error handlers for the application.
// It logs server errors, returns safe responses to clients,
// and handles requests to routes that don't exist.
// ─────────────────────────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyError } from "fastify";
import { logger } from "./logger";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError, request, reply) => {

      // =========================================================================
      // ✅ RECOMMENDED:
      // Fastify already provides the `validation` property on FastifyError.
      // There is NO need to create a custom ValidationError interface.
      // This avoids the TypeScript error:
      //
      // "Interface 'ValidationError' incorrectly extends interface 'FastifyError'"
      // =========================================================================
      if (error.statusCode === 400 && error.validation) {
        const messages = error.validation
          .map(({ message }) => message)
          .filter(Boolean)
          .join(", ");

        logger.warn("Validation error", {
          path: request.url,
          method: request.method,
          errors: messages,
          userId: (request as any).user?.userId ?? "unauthenticated",
        });

        return reply.status(400).send({
          error: "Validation failed",
          details: messages,
        });
      }

      // Handle authentication errors
      if (error.statusCode === 401) {
        return reply.status(401).send({
          error: "Not authenticated — please sign in",
        });
      }

      // Handle missing resources
      if (error.statusCode === 404) {
        return reply.status(404).send({
          error: "Resource not found",
        });
      }

      // Log unexpected server errors
      logger.error("Unhandled server error", {
        path: request.url,
        method: request.method,
        statusCode: error.statusCode ?? 500,
        error: error.message,

        // Include stack trace only outside production
        stack:
          process.env.NODE_ENV !== "production"
            ? error.stack
            : undefined,

        userId: (request as any).user?.userId ?? "unauthenticated",
      });

      // Don't leak internal errors in production
      const responseMessage =
        process.env.NODE_ENV === "production"
          ? "Something went wrong — we've been notified"
          : error.message;

      return reply.status(error.statusCode ?? 500).send({
        error: responseMessage,
      });
    }
  );

  // Handle requests to routes that don't exist
  app.setNotFoundHandler((request, reply) => {
    logger.warn("Route not found", {
      path: request.url,
      method: request.method,
    });

    return reply.status(404).send({
      error: `Route ${request.method} ${request.url} not found`,
    });
  });
}