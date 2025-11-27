# View Transitions API Implementation

## Overview
Enabled Next.js experimental View Transitions API to provide smooth cross-fade transitions when navigating between pages (e.g., `/llms` ↔ `/gpus`).

## Problem Identified
The blank flash was caused by **nested Suspense boundaries with `fallback={null}`**:
1. Page-level Suspense (`<Suspense fallback={null}>`) was showing nothing during transitions
2. View Transitions need visible content to transition between
3. When Suspense shows `null`, there's nothing for View Transitions to work with

## Solution

### 1. Removed Page-Level Suspense Boundaries
- Removed manual `<Suspense>` wrappers from `page.tsx` files
- Let Next.js automatically handle Suspense via route-level `loading.tsx`

### 2. Added Route-Level Loading Files
- Created `src/app/gpus/loading.tsx`
- Created `src/app/llms/loading.tsx`
- Next.js automatically wraps pages in Suspense with these as fallback

### 3. Next.js Configuration (`next.config.mjs`)
```javascript
experimental: {
  reactCompiler: true,
  viewTransition: true, // ✅ Enabled
}
```

### 4. Navigation Handlers Updated

**File: `src/features/data-explorer/table/data-table-infinite.tsx`**
- Wrapped `router.push()` in `startTransition()` for smooth transitions
- Used when navigating via the desktop navigation dropdown

**File: `src/features/data-explorer/table/account-components.tsx`**
- Wrapped `router.push()` in `React.startTransition()` for smooth transitions
- Used when navigating via mobile navigation

## How It Works

1. **Route-Level Suspense**: Next.js automatically wraps pages in Suspense when `loading.tsx` exists
2. **View Transitions**: With proper Suspense boundaries (not `null`), View Transitions can transition between old and new content
3. **Link Components**: Next.js automatically handles View Transitions for `<Link>` components when `viewTransition: true` is enabled
4. **Programmatic Navigation**: We wrap `router.push()` calls in `startTransition()` to ensure smooth transitions

## Key Fix

**Before (causing blank flash):**
```tsx
// page.tsx
<Suspense fallback={null}>
  <GpuDataStreamInner />
</Suspense>
```

**After (smooth transitions):**
```tsx
// page.tsx - No manual Suspense
<GpuDataStreamInner />

// loading.tsx - Route-level Suspense handled automatically
export default function Loading() {
  return null; // Minimal, but Suspense boundary exists
}
```

## Browser Support

- ✅ Chrome 111+
- ✅ Edge 111+
- ✅ Opera 97+
- ⚠️ Safari: Limited support (Technology Preview)
- ⚠️ Firefox: Not yet supported

**Fallback**: Browsers without support will use standard navigation (no transition, but still functional)

## Testing

1. Navigate between `/llms` and `/gpus` pages
2. You should see a smooth cross-fade transition instead of a blank screen
3. Test both:
   - Link navigation (dropdown menus, bookmarks)
   - Programmatic navigation (Select dropdown, mobile nav)

## Expected Behavior

- ✅ Smooth cross-fade transition between pages
- ✅ Current page stays visible during transition
- ✅ No blank screen during navigation
- ✅ Works with cached data (React Query)

## Notes

- **Experimental**: This feature is experimental and may change
- **Production**: Test thoroughly before deploying to production
- **Performance**: View Transitions are lightweight and don't impact performance significantly

## Troubleshooting

If transitions don't work:
1. Check browser support (Chrome 111+)
2. Verify `viewTransition: true` is enabled in `next.config.mjs`
3. Check browser console for errors
4. Ensure you're testing client-side navigation (not full page reloads)

## Future Enhancements

- Consider adding `viewTransitionName` CSS properties for shared element transitions
- Monitor Next.js updates for stable release
- Consider using `next-view-transitions` package if needed for more control

