# Contact Form Implementation Plan (Settings Dialog)

This document captures the agreed plan for adding a public-facing “Contact/Submit” section inside the Settings dialog using React Hook Form + Zod + Formspree.

## Goals
- Add a modern contact form with instant validation and a clean success state.
- Keep the implementation client-side only (no custom API routes).
- Make the section available to unauthenticated users.
- Ensure the form resets after the dialog is closed (no stale success state).

## Scope
- Target dialog: `src/features/data-explorer/table/settings-dialog.tsx`
- New form component: `src/features/data-explorer/table/settings-contact-form.tsx`
- UI primitive: shadcn `textarea`

## Step-by-Step Plan

### 1) Add shadcn Textarea and align styling
- Command: `npx shadcn@latest add @shadcn/textarea`
- Update `src/components/ui/textarea.tsx` to match `src/components/ui/input.tsx` sizing/scale so the form looks consistent.

### 2) Add dependencies
- Install:
  - `@formspree/react`
  - `react-hook-form`
  - `@hookform/resolvers`
- Reuse existing `zod` dependency.

### 3) Build the contact form component
Create `src/features/data-explorer/table/settings-contact-form.tsx` with:
- `"use client"` directive.
- Zod schema with keys that exactly match input `name` attributes:
  - `name`
  - `email`
  - `message`
- RHF setup:
  - `useForm({ resolver: zodResolver(schema), mode: "onChange" })`
  - `defaultValues` prefilled from `user` if available
- Formspree integration:
  - `const [state, handleFormspreeSubmit] = useForm(formId)`
  - Bridge RHF to Formspree event:
    - `handleSubmit((_, event) => event && handleFormspreeSubmit(event))`
- Honeypot field:
  - `<input type="text" name="_gotcha" ...>` hidden via `sr-only`, not registered with RHF/Zod
  - `aria-hidden="true"`, `tabIndex={-1}`, `autoComplete="off"`
- Accessibility:
  - `aria-invalid`, `aria-describedby` on fields
  - `aria-live="polite"` for submit errors and success

### 4) Wire the contact section into SettingsDialog
- Add a new nav item:
  - `{ value: "contact", label: "Contact", icon: ... }`
- Update unauth filter to allow:
  - `appearance`
  - `contact`
- Render the new section in the main panel.

### 5) Reset-on-close behavior
- The Settings dialog is conditionally rendered, so closing it unmounts the form.
- Unmounting resets RHF and Formspree state, preventing the “success” state from persisting.
- If this ever changes to keep the dialog mounted, add an explicit `reset()` and a remount key.

### 6) Formspree configuration
- Env var: `NEXT_PUBLIC_FORMSPREE_FORM_ID`
- If missing, show a graceful fallback message in the section.
- Do not hardcode the ID.

## Non-Goals (Out of Scope)
- No custom API routes or backend ingestion.
- No external captcha integration beyond Formspree defaults.
- No server actions or background jobs.

## Acceptance Criteria
- Contact form works for signed-in and guest users.
- Form validation happens instantly on input change.
- Successful submission shows a confirmation message.
- Closing/reopening Settings clears success state and form input.
- Styling matches existing `Input` component.


FORM ID= xaqnaqkz