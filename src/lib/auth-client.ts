import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({});
export const { signIn, signUp, useSession, signOut, resetPassword } = authClient;
export type Session = typeof authClient.$Infer.Session;

