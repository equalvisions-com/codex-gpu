class HttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "HttpError";
  }
}

async function parseErrorMessage(response: Response) {
  try {
    const text = await response.text();
    if (!text) return null;
    const parsed = JSON.parse(text);
    return parsed?.error || parsed?.message || null;
  } catch {
    return null;
  }
}

interface FetchJsonOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Returns true for errors that are worth retrying: 5xx status codes and
 * network-level failures (TypeError from fetch, AbortError from timeout).
 * 4xx errors are never retried.
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status >= 500;
  }
  // Network errors thrown by fetch() are TypeErrors; timeout aborts are AbortErrors.
  if (error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError")) {
    return true;
  }
  return false;
}

/** Default timeout for fetch requests (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Default maximum number of retries for transient failures */
const DEFAULT_MAX_RETRIES = 2;

/** Base delay for exponential backoff between retries (milliseconds) */
const BACKOFF_BASE_MS = 500;

/**
 * Fetches JSON with timeout (AbortSignal.timeout) and retry with exponential backoff.
 */
export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: FetchJsonOptions,
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES, ...fetchInit } = init ?? {};

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Combine caller-provided signal (if any) with our timeout signal.
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const signal = fetchInit.signal
        ? AbortSignal.any([fetchInit.signal, timeoutSignal])
        : timeoutSignal;

      const response = await fetch(input, { ...fetchInit, signal });

      if (!response.ok) {
        const message =
          (await parseErrorMessage(response)) ??
          `Request failed with status ${response.status}`;
        throw new HttpError(message, response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts or the error isn't retryable.
      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Exponential backoff: 500ms, 1000ms, ...
      const backoff = BACKOFF_BASE_MS * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  // Should be unreachable, but satisfies the type checker.
  throw lastError;
}
