import { Resend } from "resend";

const FROM_EMAIL_FALLBACK = "noreply@yourdomain.com";

function getResendClient(apiKey?: string) {
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const resend = getResendClient(process.env.RESEND_API_KEY);
  const fromAddress = process.env.RESEND_FROM_EMAIL || FROM_EMAIL_FALLBACK;

  try {
    const emailOptions = {
      from: fromAddress,
      to,
      subject,
      html,
      text,
    };

    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error("Failed to send email:", error);
      throw new Error(`Email sending failed: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Email service error:", error);
    throw error;
  }
}

export async function sendVerificationEmail({
  to,
  verificationUrl,
}: {
  to: string;
  verificationUrl: string;
}) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - OpenStatus</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">Welcome to OpenStatus!</h1>
        </div>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
          <h2 style="margin-top: 0; color: #1f2937;">Verify Your Email Address</h2>
          <p style="margin-bottom: 20px;">
            Thanks for signing up! To complete your registration and start exploring GPU instances, please verify your email address.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Verify Email Address
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
            If the button doesn't work, copy and paste this link into your browser:
            <br>
            <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
          </p>
        </div>

        <div style="text-align: center; color: #6b7280; font-size: 14px;">
          <p>If you didn't create an account, you can safely ignore this email.</p>
          <p>© 2025 OpenStatus. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const text = `
Welcome to OpenStatus!

Thanks for signing up! To complete your registration and start exploring GPU instances, please verify your email address by clicking the link below:

${verificationUrl}

If you didn't create an account, you can safely ignore this email.

© 2025 OpenStatus. All rights reserved.
  `;

  return sendEmail({
    to,
    subject: "Verify Your Email - OpenStatus",
    html,
    text,
  });
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - OpenStatus</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">OpenStatus</h1>
        </div>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
          <h2 style="margin-top: 0; color: #1f2937;">Reset Your Password</h2>
          <p style="margin-bottom: 20px;">
            We received a request to reset your password. Click the button below to create a new password.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
            This link will expire in 1 hour for security reasons.
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
            If the button doesn't work, copy and paste this link into your browser:
            <br>
            <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>

        <div style="text-align: center; color: #6b7280; font-size: 14px;">
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
          <p>© 2025 OpenStatus. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const text = `
OpenStatus - Reset Your Password

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email.

© 2025 OpenStatus. All rights reserved.
  `;

  return sendEmail({
    to,
    subject: "Reset Your Password - OpenStatus",
    html,
    text,
  });
}
