import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { gpuPriceSamples, modelLatencySamples, modelThroughputSamples } from "@/db/schema";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { sql } from "drizzle-orm";

// Retention period: 90 days
const RETENTION_DAYS = 90;

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffIso = cutoff.toISOString();

  try {
    const [gpuDeleted, latencyDeleted, throughputDeleted] = await Promise.all([
      db.delete(gpuPriceSamples)
        .where(sql`${gpuPriceSamples.observedAt} < ${cutoffIso}`)
        .returning({ id: gpuPriceSamples.stableKey }),
      db.delete(modelLatencySamples)
        .where(sql`${modelLatencySamples.observedAt} < ${cutoffIso}`)
        .returning({ id: modelLatencySamples.permaslug }),
      db.delete(modelThroughputSamples)
        .where(sql`${modelThroughputSamples.observedAt} < ${cutoffIso}`)
        .returning({ id: modelThroughputSamples.permaslug }),
    ]);

    const result = {
      success: true,
      retentionDays: RETENTION_DAYS,
      cutoff: cutoffIso,
      deleted: {
        gpuPriceSamples: gpuDeleted.length,
        modelLatencySamples: latencyDeleted.length,
        modelThroughputSamples: throughputDeleted.length,
      },
    };

    logger.info("[retention-cleanup]", result);
    return Response.json(result);
  } catch (error) {
    logger.error("[retention-cleanup] Failed:", error);
    return Response.json(
      { error: "Retention cleanup failed" },
      { status: 500 },
    );
  }
}
