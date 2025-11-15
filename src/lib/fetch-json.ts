export class HttpError extends Error {
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

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const message = (await parseErrorMessage(response)) ?? `Request failed with status ${response.status}`;
    throw new HttpError(message, response.status);
  }
  return (await response.json()) as T;
}
