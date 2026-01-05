import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        newsletter: {
          type: "boolean",
          required: false,
        },
      },
    }),
  ],
});
export type Session = typeof authClient.$Infer.Session;
