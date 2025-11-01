# Favorites Cache Seeding Analysis

## Current Implementation Flow

### Server-Side Seeding (`src/app/llms/page.tsx`)

```typescript
let initialFavoriteKeys: string[] | undefined;
if (session) {
  try {
    // 1. Try cache-first (unstable_cache)
    initialFavoriteKeys = await getUserModelFavoritesFromCache(session.user.id);
  } catch (error) {
    // 2. Fallback to DB if cache fails (including size limit)
    console.warn("[llms page] favorites cache miss, falling back to DB", {...});
    try {
      initialFavoriteKeys = await getUserModelFavoritesDirect(session.user.id);
    } catch (dbError) {
      initialFavoriteKeys = [];
    }
  }
}
```

**Behavior:**
- ✅ Cache-first: Uses `unstable_cache` to avoid DB hit
- ✅ DB fallback: If cache fails (error thrown), falls back to direct DB query
- ✅ Seeds client: `initialFavoriteKeys` passed to `<ModelsClient>`

### Client-Side Lazy Loading (`src/components/models-table/models-checked-actions-island.tsx`)

```typescript
// Only fetches when user checks a box
const { data: favorites = [] } = useQuery({
  queryKey: MODEL_FAVORITES_QUERY_KEY,
  queryFn: getModelFavorites,  // Calls /api/models/favorites
  enabled: hasSelection,  // ← LAZY: Only when checkbox checked
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
});

// Seed React Query cache with server data if available
React.useEffect(() => {
  const existing = queryClient.getQueryData<ModelFavoriteKey[]>(MODEL_FAVORITES_QUERY_KEY);
  if (!existing && initialFavoriteKeys) {
    queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, initialFavoriteKeys);
  }
}, [initialFavoriteKeys, queryClient]);
```

**Behavior:**
- ✅ Lazy fetch: Only calls API when `hasSelection` is true (user checks box)
- ✅ Server seeding: If `initialFavoriteKeys` exists, seeds React Query cache
- ✅ No redundant fetch: If seeded, query never runs (`enabled: hasSelection` prevents it)

---

## The 2MB Cache Limit Issue

### Next.js `unstable_cache` Behavior

Next.js `unstable_cache` has a **2MB size limit per cache entry**. If the serialized value exceeds 2MB:

1. **Next.js may throw an error** (depending on implementation)
2. **Or silently fail to cache** (returns DB result but doesn't cache)

### Current Code Analysis

**Problem:** The current implementation doesn't explicitly check for cache size before attempting to cache.

```typescript
// src/lib/model-favorites/cache.ts
export async function getUserModelFavoritesFromCache(userId: string): Promise<ModelFavoriteKey[]> {
  const getCached = unstable_cache(
    async (uid: string) => {
      // This always queries DB - caching happens at wrapper level
      const rows = await db.select()...
      return rows.map((r) => r.modelId);
    },
    ["model-favorites:keys", userId],
    { revalidate: MODEL_FAVORITES_CACHE_TTL, tags: [...] }
  );
  return getCached(userId);  // ← If > 2MB, Next.js may fail silently or throw
}
```

**What happens:**
- If favorites array < 2MB: ✅ Cached successfully
- If favorites array > 2MB: 
  - Next.js may throw an error → caught by catch block → falls back to DB ✅
  - OR Next.js may silently fail → cache miss → queries DB anyway ✅
  - Either way, DB fallback works, but we might not know cache failed

---

## Verification: Is This Working Correctly?

### Scenario 1: Cache Works (< 2MB)
1. Server calls `getUserModelFavoritesFromCache()` → cached ✅
2. Returns cached keys → `initialFavoriteKeys` populated ✅
3. Client receives `initialFavoriteKeys` → seeds React Query ✅
4. User checks box → no API call needed (data already in cache) ✅

### Scenario 2: Cache Fails (> 2MB or error)
1. Server calls `getUserModelFavoritesFromCache()` → throws error or fails ✅
2. Catch block → `getUserModelFavoritesDirect()` → DB query ✅
3. Returns DB keys → `initialFavoriteKeys` populated ✅
4. Client receives `initialFavoriteKeys` → seeds React Query ✅
5. User checks box → no API call needed (data already seeded) ✅

### Scenario 3: No Cache Seed (cache unavailable, DB also fails)
1. Server cache fails → catch block
2. DB also fails → `initialFavoriteKeys = []` ✅
3. Client receives `undefined` or `[]` → no seed ✅
4. User checks box → `enabled: hasSelection` → API call made ✅
5. **Lazy DB hit** via `/api/models/favorites` ✅

---

## Potential Issues

### Issue 1: Silent Cache Failures

If Next.js silently fails to cache (doesn't throw), the code will:
- Always query DB (cache miss)
- Not know cache failed
- Still work, but inefficient

**Solution:** Add explicit size check before caching:

```typescript
export async function getUserModelFavoritesFromCache(userId: string): Promise<ModelFavoriteKey[]> {
  // Check size before attempting cache
  const getCached = unstable_cache(
    async (uid: string) => {
      const rows = await db.select()...
      const keys = rows.map((r) => r.modelId);
      
      // Estimate size (rough approximation)
      const estimatedSize = JSON.stringify(keys).length;
      if (estimatedSize > 2 * 1024 * 1024) {  // 2MB
        throw new Error("Cache size exceeds 2MB limit");
      }
      
      return keys;
    },
    ["model-favorites:keys", userId],
    { revalidate: MODEL_FAVORITES_CACHE_TTL, tags: [...] }
  );
  
  try {
    return await getCached(userId);
  } catch (error) {
    // Explicitly catch cache size errors
    if (error instanceof Error && error.message.includes("2MB")) {
      console.warn("[getUserModelFavoritesFromCache] Cache size limit exceeded, skipping cache", {
        userId,
      });
      throw error;  // Let caller fall back to DB
    }
    throw error;
  }
}
```

### Issue 2: No Explicit Size Validation

Current code relies on Next.js behavior, which may be inconsistent.

**Recommendation:** Add explicit size check or at least log when cache fails:

```typescript
// In llms/page.tsx
try {
  initialFavoriteKeys = await getUserModelFavoritesFromCache(session.user.id);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isSizeError = errorMessage.includes("2MB") || errorMessage.includes("size");
  
  console.warn("[llms page] favorites cache miss, falling back to DB", {
    error: errorMessage,
    isSizeLimit: isSizeError,
    userId: session.user.id,
  });
  
  // ... fallback to DB
}
```

---

## Summary: Is It Broken?

**Current Behavior:**
- ✅ Cache-first seeding works when cache is available
- ✅ DB fallback works when cache fails
- ✅ Lazy loading works when no seed available
- ⚠️ No explicit handling of 2MB limit (relies on Next.js behavior)

**Is It Broken?**
- **Functionally:** No, it works correctly via fallback
- **Optimally:** Could be improved with explicit size checks

**Recommendation:**
1. Add explicit size check in `getUserModelFavoritesFromCache()` before caching
2. Log cache size errors for monitoring
3. Consider pagination/chunking for very large favorite lists

The system is **not broken** but could be more explicit about cache size limits.

