import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as authSchema from "@/db/auth-schema";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";
import { enqueueNewsletterSync } from "@/lib/newsletter-queue";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl: url,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await sendVerificationEmail({
        to: user.email,
        verificationUrl: url,
      });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    afterEmailVerification: async (user, request) => {
      try {
        await db
          .update(authSchema.user)
          .set({ newsletterSubscribed: true })
          .where(eq(authSchema.user.id, user.id));
        await enqueueNewsletterSync({ userId: user.id, email: user.email }, request?.url);
      } catch (error) {
        console.error("Failed to enqueue newsletter sync after verification", error);
      }
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      afterDelete: async (user, request) => {
        try {
          await enqueueNewsletterSync({ email: user.email, forceUnsubscribe: true }, request?.url);
        } catch (error) {
          console.error("Failed to enqueue newsletter unsubscribe on delete", error);
        }
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (!user?.emailVerified) return;
          try {
            await enqueueNewsletterSync({ userId: user.id, email: user.email });
          } catch (error) {
            console.error("Failed to enqueue newsletter sync", error);
          }
        },
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      prompt: "select_account",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    huggingface: {
      clientId: process.env.HUGGINGFACE_CLIENT_ID!,
      clientSecret: process.env.HUGGINGFACE_CLIENT_SECRET!,
    },
  },
  plugins: [nextCookies()],
});
