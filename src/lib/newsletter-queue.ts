import "server-only";

import { Client } from "@upstash/qstash";

export type NewsletterSyncPayload = {
  email: string;
  userId?: string;
  forceUnsubscribe?: boolean;
};

const DEFAULT_FLOW_CONTROL = {
  key: "resend-newsletter",
  rate: 1,
  period: "1s",
  parallelism: 1,
} as const;

function getQStashClient() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error("QSTASH_TOKEN is not configured");
  }

  const baseUrl = process.env.QSTASH_URL;
  return new Client({ token, ...(baseUrl ? { baseUrl } : {}) });
}

function resolvePublicBaseUrl(requestUrl?: string) {
  const envBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, "");
  }

  if (requestUrl) {
    return new URL(requestUrl).origin;
  }

  throw new Error("Missing NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL for QStash callbacks");
}

function getNewsletterSyncUrl(requestUrl?: string) {
  const baseUrl = resolvePublicBaseUrl(requestUrl);
  return `${baseUrl}/api/qstash/newsletter-sync`;
}

function getNewsletterFailureUrl(requestUrl?: string) {
  const baseUrl = resolvePublicBaseUrl(requestUrl);
  return `${baseUrl}/api/qstash/newsletter-failure`;
}

export async function enqueueNewsletterSync(payload: NewsletterSyncPayload, requestUrl?: string) {
  const client = getQStashClient();
  const url = getNewsletterSyncUrl(requestUrl);
  const failureCallback = getNewsletterFailureUrl(requestUrl);

  await client.publishJSON({
    url,
    body: payload,
    retries: 5,
    failureCallback,
    flowControl: DEFAULT_FLOW_CONTROL,
  });
}
