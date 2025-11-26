import { trace } from "@opentelemetry/api";

type RequestLike = Request | { headers: Headers };

export interface RequestLogContext {
  traceId?: string;
  requestId?: string;
  vercelId?: string;
  edgeRegion?: string;
  edgeWorker?: string;
  ipCountry?: string;
  ipCity?: string;
  forwardedFor?: string;
  userAgent?: string;
}

function parseVercelId(vercelId: string | undefined) {
  if (!vercelId) {
    return { edgeRegion: undefined, edgeWorker: undefined, requestId: undefined };
  }

  const [region, worker, request] = vercelId.split(":");
  return {
    edgeRegion: region,
    edgeWorker: worker,
    requestId: request ?? vercelId,
  };
}

export function getRequestLogContext(request: RequestLike): RequestLogContext {
  const headers = "headers" in request ? request.headers : new Headers();
  const vercelId = headers.get("x-vercel-id") ?? undefined;
  const { edgeRegion, edgeWorker, requestId } = parseVercelId(vercelId);
  const span = trace.getActiveSpan();
  const traceId = span?.spanContext().traceId;

  return {
    traceId: traceId && traceId !== "00000000000000000000000000000000" ? traceId : undefined,
    requestId,
    vercelId,
    edgeRegion,
    edgeWorker,
    ipCountry: headers.get("x-vercel-ip-country") ?? undefined,
    ipCity: headers.get("x-vercel-ip-city") ?? undefined,
    forwardedFor: headers.get("x-forwarded-for") ?? undefined,
    userAgent: headers.get("user-agent") ?? undefined,
  };
}

