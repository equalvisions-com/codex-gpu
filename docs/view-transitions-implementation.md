# View Transitions API Implementation

## Overview
Enabled Next.js experimental View Transitions API to provide smooth cross-fade transitions when navigating between pages (e.g., `/llms` ↔ `/gpus`).

## Changes Made

### 1. Next.js Configuration (`next.config.mjs`)
```javascript
experimental: {
  reactCompiler: true,
  viewTransition: true, // ✅ Enabled
}
```

### 2. Navigation Handlers Updated

**File: `src/features/data-explorer/table/data-table-infinite.tsx`**
- Wrapped `router.push()` in `startTransition()` for smooth transitions
- Used when navigating via the desktop navigation dropdown

**File: `src/features/data-explorer/table/account-components.tsx`**
- Wrapped `router.push()` in `React.startTransition()` for smooth transitions
- Used when navigating via mobile navigation

## How It Works

1. **Link Components**: Next.js automatically handles View Transitions for `<Link>` components when `viewTransition: true` is enabled
2. **Programmatic Navigation**: We wrap `router.push()` calls in `startTransition()` to ensure smooth transitions

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

