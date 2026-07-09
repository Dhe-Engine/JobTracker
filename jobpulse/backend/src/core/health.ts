// backend/src/core/health.ts

/*
what this file does:
    - registers application health check endpoints
    - verifies the database, Redis, and background workers are healthy
    - provides both basic and detailed health information
    - helps monitoring services detect and report application issues
*/

import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { emailScanQueue } from "../workers/email-scan.worker";
import { logger } from "./logger";

// Health status returned for a single dependency
interface DependencyStatus {
  status:  "ok" | "degraded" | "down";
  latency: string;
  error?:  string;
}

// Complete response returned by the detailed health endpoint
interface HealthPayload {
  status:    "ok" | "degraded" | "down";
  version:   string;
  uptime:    string;
  timestamp: string;
  checks: {
    database: DependencyStatus;
    redis:    DependencyStatus;
    workers:  DependencyStatus;
  };
}

// ── Health check helpers ─────────────────────────────────────────────────────

async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();

  try {
    // Run a small query to confirm the database is reachable
    const { error } = await db.from("users").select("id").limit(1);
    if (error) throw new Error(error.message);

    return {
      status: "ok",
      latency: `${Date.now() - start}ms`,
    };
  } catch (err) {
    return {
      status: "down",
      latency: `${Date.now() - start}ms`,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkRedis(): Promise<DependencyStatus> {
  const start = Date.now();

  try {
    //check if BullMQ successfully talk to Redis
    await emailScanQueue.getJobCounts();

    return {
      status: "ok",
      latency: `${Date.now() - start}ms`,
    };
  } catch (err) {
    return {
      status: "down",
      latency: `${Date.now() - start}ms`,
      error: err instanceof Error ? err.message : "Redis unreachable",
    };
  }
}

async function checkWorkers(): Promise<DependencyStatus> {
  const start = Date.now();

  try {
    // Inspect the queue to detect stuck or failing background jobs
    const [waiting, failed] = await Promise.all([
      emailScanQueue.getWaitingCount(),
      emailScanQueue.getFailedCount(),
    ]);

    // Too many waiting jobs usually means workers are not keeping up
    if (waiting > 100) {
      return {
        status: "degraded",
        latency: `${Date.now() - start}ms`,
        error: `${waiting} jobs waiting in queue`,
      };
    }

    // Too many failed jobs indicates recurring processing problems
    if (failed > 50) {
      return {
        status: "degraded",
        latency: `${Date.now() - start}ms`,
        error: `${failed} failed jobs — check logs`,
      };
    }

    return {
      status: "ok",
      latency: `${Date.now() - start}ms`,
    };
  } catch (err) {
    return {
      status: "down",
      latency: `${Date.now() - start}ms`,
      error: err instanceof Error ? err.message : "Worker check failed",
    };
  }
}

// ── Health routes ────────────────────────────────────────────────────────────

export async function registerHealthRoutes(app: FastifyInstance) {

  // Basic health check used to confirm the server is running
  app.get("/health", async (_req, reply) => {
    return reply.send({
      status: "ok",
      ts: new Date().toISOString(),
    });
  });

  // Detailed health check that verifies all major services
  app.get("/health/deep", async (_req, reply) => {
    const [database, redis, workers] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkWorkers(),
    ]);

    // Overall health matches the worst dependency status
    const statuses = [database.status, redis.status, workers.status];

    const overallStatus =
      statuses.includes("down")
        ? "down"
        : statuses.includes("degraded")
        ? "degraded"
        : "ok";

    const payload: HealthPayload = {
      status: overallStatus,
      version: process.env.npm_package_version ?? "unknown",

      // Convert process uptime into a readable format
      uptime: formatUptime(process.uptime()),

      timestamp: new Date().toISOString(),
      checks: {
        database,
        redis,
        workers,
      },
    };

    // Record unhealthy states in the application logs
    if (overallStatus !== "ok") {
      logger.warn("Health check degraded", {
        checks: payload.checks,
      });
    }

    // Return 503 when the application is considered unavailable
    const statusCode = overallStatus === "down" ? 503 : 200;

    return reply.status(statusCode).send(payload);
  });
}

// Convert uptime in seconds into a readable duration
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts = [];

  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);

  parts.push(`${m}m`);

  return parts.join(" ");
}