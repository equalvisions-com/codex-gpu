// Route-level loading UI for /gpus
// Next.js automatically wraps the page in Suspense with this as fallback
// 
// IMPORTANT: With View Transitions enabled, you'll see the OLD page content
// during navigation, not this loading state. View Transitions keeps the old
// page visible and cross-fades to the new page as it streams in.
//
// This loading.tsx only shows if View Transitions aren't supported or if
// there's an error. Returning null here ensures minimal visual disruption.
export default function Loading() {
  return null; // Minimal - View Transitions handles the visual transition
}

