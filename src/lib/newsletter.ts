import "server-only";

const RESEND_API_BASE = "https://api.resend.com";

type ResendContact = {
  id?: string;
  email?: string;
  unsubscribed?: boolean;
};

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const segmentId = process.env.RESEND_NEWSLETTER_SEGMENT_ID;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!segmentId) {
    throw new Error("RESEND_NEWSLETTER_SEGMENT_ID is not configured");
  }

  return { apiKey, segmentId };
}

async function resendFetch(path: string, options: RequestInit) {
  const { apiKey } = getResendConfig();
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`${RESEND_API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });

    if (response.status === 429 && attempt < maxAttempts - 1) {
      const retryAfter = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
      const delayMs = Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds * 1000
        : 500 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    return { ok: response.ok, status: response.status, data };
  }

  return { ok: false, status: 429, data: { message: "Rate limited" } };
}

function extractContact(data: unknown): ResendContact | null {
  if (!data || typeof data !== "object") return null;
  if ("data" in data && data.data && typeof data.data === "object") {
    return data.data as ResendContact;
  }
  return data as ResendContact;
}

function extractContactId(data: unknown) {
  const contact = extractContact(data);
  return contact?.id;
}

function extractErrorMessage(data: unknown) {
  if (!data || typeof data !== "object") return undefined;
  if ("message" in data && typeof data.message === "string") {
    return data.message;
  }
  if ("error" in data) {
    const error = data.error as { message?: string } | undefined;
    if (error?.message) return error.message;
  }
  return undefined;
}

function splitName(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function getContactByEmail(email: string) {
  const response = await resendFetch(`/contacts/${encodeURIComponent(email)}`, {
    method: "GET",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch newsletter contact.");
  }

  return extractContact(response.data);
}

async function createContact(email: string, name?: string | null, unsubscribed = false) {
  const { firstName, lastName } = splitName(name);
  const response = await resendFetch("/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      unsubscribed,
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
    }),
  });

  if (response.ok) {
    return extractContactId(response.data);
  }

  if (response.status === 409) {
    return null;
  }

  throw new Error("Failed to create newsletter contact.");
}

async function updateContact(email: string, unsubscribed: boolean) {
  const response = await resendFetch(`/contacts/${encodeURIComponent(email)}`, {
    method: "PATCH",
    body: JSON.stringify({ unsubscribed }),
  });

  if (!response.ok) {
    throw new Error("Failed to update newsletter contact.");
  }
}

async function addContactToSegment(email: string, contactId?: string | null) {
  const { segmentId } = getResendConfig();
  const identifier = contactId || email;
  const response = await resendFetch(
    `/contacts/${encodeURIComponent(identifier)}/segments/${encodeURIComponent(segmentId)}`,
    { method: "POST" }
  );

  if (!response.ok && response.status !== 409) {
    const message = extractErrorMessage(response.data);
    if (response.status === 404) {
      if (contactId) {
        return addContactToSegment(email, null);
      }
      const existing = await getContactByEmail(email);
      if (existing?.id) {
        return addContactToSegment(email, existing.id);
      }
    }
    throw new Error(
      message
        ? `Failed to add contact to newsletter segment (status ${response.status}): ${message}`
        : `Failed to add contact to newsletter segment (status ${response.status}).`
    );
  }
}

export async function ensureNewsletterSubscribed({
  email,
  name,
}: {
  email: string;
  name?: string | null;
}) {
  const contactId = await createContact(email, name, false);
  if (!contactId) {
    await updateContact(email, false);
  }

  await addContactToSegment(email, contactId);
}

export async function unsubscribeNewsletter(email: string) {
  const contact = await getContactByEmail(email);
  if (!contact) return;
  await updateContact(email, true);
}
