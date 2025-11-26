import { redirect } from "next/navigation";

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(input?: string | string[]) {
  if (!input) return undefined;
  return Array.isArray(input) ? input[0] : input;
}

export default async function SignUpRedirect({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const params = new URLSearchParams();
  params.set("auth", "signup");

  const callbackUrl = firstValue(resolved.callbackUrl);
  if (callbackUrl) {
    params.set("callbackUrl", callbackUrl);
  }

  const email = firstValue(resolved.email);
  if (email) {
    params.set("email", email);
  }

  const errorCallbackUrl = firstValue(resolved.errorCallbackUrl);
  if (errorCallbackUrl) {
    params.set("errorCallbackUrl", errorCallbackUrl);
  }

  redirect(`/?${params.toString()}`);
}
