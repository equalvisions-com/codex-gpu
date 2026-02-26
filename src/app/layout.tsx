import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ReactQueryProvider } from "@/providers/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AuthProvider } from "@/providers/auth-provider";
import { AuthDialogProvider } from "@/providers/auth-dialog-provider";
import { AuthDialogParamsSync } from "@/providers/auth-dialog-params-sync";
import PlausibleProvider from "next-plausible";

const TITLE = "Deploybase";
const DESCRIPTION =
  "Real-time GPU and LLM pricing across all providers. Compare providers, models, and pricing.";

const DEFAULT_SITE_URL = "https://deploybase.ai";

function resolveMetadataBase() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!envUrl) {
    return new URL(DEFAULT_SITE_URL);
  }

  try {
    const normalized = envUrl.startsWith("http")
      ? envUrl
      : `https://${envUrl}`;
    return new URL(normalized);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: TITLE,
  description: DESCRIPTION,
  // Disable iOS Safari data detectors (smart links) to avoid dotted underlines
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  twitter: {
    images: ["/assets/data-table-infinite.png"],
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  openGraph: {
    type: "website",
    images: ["/assets/data-table-infinite.png"],
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <PlausibleProvider domain="deploybase.ai" trackOutboundLinks />
      </head>
      <body className="min-h-[100dvh] bg-background antialiased overscroll-x-none">
        <AuthProvider>
          <ReactQueryProvider>
            <NuqsAdapter>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <AuthDialogProvider>
                  <main id="content" className="flex min-h-[100dvh] flex-col">
                    {children}
                  </main>
                  <Suspense fallback={null}>
                    <AuthDialogParamsSync />
                  </Suspense>
                </AuthDialogProvider>
              </ThemeProvider>
            </NuqsAdapter>
          </ReactQueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
