# Comprehensive Analysis: Favorites Mechanism & Filter View

## Overview

The favorites system enables users to save AI models for quick access. It includes a dedicated "favorites mode" that filters the table to show only favorited models, cross-tab synchronization via BroadcastChannel, and optimistic UI updates with rollback on errors.

---

## Architecture Components

### 1. **Data Storage Layer**

#### Database Schema (`src/db/schema.ts`)
- Table: `userModelFavorites`
- Fields: `id`, `userId`, `modelId`, `createdAt`
- One-to-many relationship: one user can have many favorite models

#### Cache Layer (`src/lib/model-favorites/cache.ts`)
- **Cache-first strategy**: `getUserModelFavoritesFromCache()` → `getUserModelFavoritesDirect()`
- Cache TTL: 43,200 seconds (12 hours) via `MODEL_FAVORITES_CACHE_TTL`
- Cache tag pattern: `model-favorites:user:${userId}`

#### API Routes (`src/app/api/models/favorites/route.ts`)
- **GET**: Fetch user's favorites list
- **POST**: Add favorites (batch, max 100 per request)
- **DELETE**: Remove favorites (batch, max 100 per request)
- Rate limiting: Upstash Redis (`writeLimiter`) per user
- Validation: Zod schema for request bodies

---

### 2. **Key Identification System**

#### Stable Model Keys (`src/components/models-table/stable-key.ts`)
```typescript
function stableModelKey(row: Partial<Pick<ModelsColumnSchema, "id" | "slug" | "provider" | "name">>): string
```

**Key Generation Logic:**
1. Primary: Use `row.id` if available
2. Fallback: `provider:slug` or `provider:name` (lowercase, trimmed)
3. Purpose: Ensures consistent identification even if model data changes

**Why Stable Keys Matter:**
- Favorites persist across model schema updates
- Supports both UUID-based and composite identifiers
- Enables matching favorites to fetched rows via dual-key mapping

---

### 3. **State Management Architecture**

#### React Query Cache Keys
- **Favorites List**: `["model-favorites"]` → `ModelFavoriteKey[]`
- **Favorites Rows**: `["model-favorites", "rows"]` → `ModelsColumnSchema[]`

#### Local State (`models-checked-actions-island.tsx`)
- `localFavorites`: Optimistic state for immediate UI updates
- `checkedRows`: Independent checkbox state (separate from row selection)
- `isMutating`: Prevents concurrent mutations

#### Broadcast Channel (`MODEL_FAVORITES_BROADCAST_CHANNEL`)
- Channel name: `"model-favorites"`
- Message format: `{ type: "updated", favorites: ModelFavoriteKey[], source: broadcastId }`
- Purpose: Sync favorites across browser tabs/windows
- Source tracking: Prevents echo loops

---

## Favorites Mechanism Flow

### A. Initial Load Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Server Component (llms/page.tsx)                        │
│    - Checks ?favorites=true URL param                       │
│    - Loads session from cookies/headers                      │
│    - Fetches initialFavoriteKeys from cache/DB               │
│    - Passes to <ModelsClient>                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ModelsClient Component                                    │
│    - Receives initialFavoriteKeys & isFavoritesMode         │
│    - Syncs favorites to React Query cache                   │
│    - Sets up BroadcastChannel listener                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Data Fetching (Conditional)                              │
│    IF isFavoritesMode:                                       │
│      - Query: ["model-favorites", "rows"]                   │
│      - Fetches rows via /api/models/favorites/rows          │
│      - Chunked requests (200 keys per batch)                │
│    ELSE:                                                     │
│      - Infinite query: modelsDataOptions                    │
│      - Standard pagination                                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. ModelsDataTableInfinite                                  │
│    - Receives initialFavoriteKeys in meta prop              │
│    - Passes to ModelsCheckedActionsIsland                   │
│    - Manages checkedRows state (independent from selection) │
└─────────────────────────────────────────────────────────────┘
```

### B. Adding Favorites Flow

```typescript
// User clicks checkbox → checkedRows updated
// User clicks "Favorite" button → handleFavorite() called

1. Check Selection
   - Validates hasSelection (at least one checked row visible)
   - Prompts auth if not authenticated

2. Determine Favorite Status
   - Maps checkedRows → row IDs → stableModelKey()
   - Computes: alreadyFavorited[], notFavorited[]
   - Sets: shouldAdd (if any not favorited), shouldRemove (if all favorited)

3. Optimistic Update
   - Cancels pending queries
   - Updates React Query cache: MODEL_FAVORITES_QUERY_KEY
   - Updates localFavorites state
   - If removing: Filters ["model-favorites", "rows"] cache

4. API Mutation
   - Parallel: addModelFavorites(toAdd) + removeModelFavorites(toRemove)
   - On success: Fetches new rows for added favorites
   - Merges new rows into ["model-favorites", "rows"] cache
   - Broadcasts update via BroadcastChannel

5. Error Handling
   - Rolls back optimistic update
   - Shows error notice (rate limit, timeout, network)
   - Invalidates cache if needed
```

### C. Removing Favorites Flow

Similar to adding, but:
- Removes from cache immediately (optimistic)
- Removes from ["model-favorites", "rows"] cache
- Clears rows cache if favorites become empty

---

## Favorites Filter View (Favorites Mode)

### Activation

**URL Parameter**: `?favorites=true`

```typescript
// src/app/llms/page.tsx
const isFavoritesMode = params.favorites === "true";
```

### Behavior Changes in Favorites Mode

#### 1. **Data Source Switching**
```typescript
// models-client.tsx:252-258
const flatData = React.useMemo(() => {
  if (isFavoritesMode) {
    if (favoriteKeysArray.length === 0) return [];
    return (favoriteRows ?? []) as ModelsColumnSchema[];
  }
  return (data?.pages?.flatMap(...) ?? []) as ModelsColumnSchema[];
}, [data?.pages, favoriteKeysArray.length, favoriteRows, isFavoritesMode]);
```

**Key Differences:**
- **Normal Mode**: Infinite query with server-side pagination
- **Favorites Mode**: Single query fetching all favorite rows (no pagination)

#### 2. **Query Disabling**
```typescript
// models-client.tsx:236-246
const { data, ... } = useInfiniteQuery({
  ...modelsDataOptions(search),
  enabled: !isFavoritesMode,  // ← Disabled in favorites mode
});

const { data: favoriteRows = [] } = useQuery({
  queryKey: ["model-favorites", "rows"],
  queryFn: fetchFavoriteRows,
  enabled: isFavoritesMode && favoriteKeysArray.length > 0,  // ← Enabled only in favorites mode
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
});
```

#### 3. **Facets Disabled**
```typescript
// models-client.tsx:261-271
const rawFacets = isFavoritesMode ? {} : lastPage?.meta?.facets;
// ...
const stableFacets = React.useMemo(() => {
  if (isFavoritesMode) return {};  // ← No facets in favorites mode
  return rawFacets && Object.keys(rawFacets).length ? rawFacets : facetsRef.current ?? {};
}, [rawFacets, isFavoritesMode]);
```

**Why:** Favorites are a curated subset; facets would be inaccurate/meaningless.

#### 4. **Pagination Disabled**
```typescript
// models-client.tsx:407-411
isFetching={isFavoritesMode ? false : isFetching}
isLoading={isFavoritesMode ? false : isLoading}
isFetchingNextPage={isFavoritesMode ? false : isFetchingNextPage}
fetchNextPage={isFavoritesMode ? () => Promise.resolve() : fetchNextPage}
hasNextPage={isFavoritesMode ? false : hasNextPage}
```

**Rationale:** All favorites are loaded at once; no infinite scroll needed.

#### 5. **Filter Fields Still Available**
```typescript
// models-client.tsx:358-386
const filterFields = React.useMemo(() => {
  return defaultFilterFields.map((field) => {
    // Filters are still processed, but facets are empty in favorites mode
    const facetsField = castFacets?.[field.value];
    // ...
  });
}, [stableFacets]);
```

**Note:** Filter fields (Search, Provider, Modalities, etc.) remain functional in favorites mode, but:
- Facets are empty (no counts/precomputed values)
- Filters operate on the already-filtered favorites list
- This allows users to search/filter within their favorites

#### 6. **Table Key Reset**
```typescript
// models-client.tsx:390
key={`models-table-${isFavoritesMode ? `favorites-${favorites?.length || 0}` : "all"}`}
```

**Purpose:** Forces React remount when switching modes to reset internal state.

---

## Checked Rows vs Row Selection

### Two Independent Systems

#### 1. **Row Selection** (`rowSelection`)
- **Purpose**: Controls which row opens the details sheet
- **State**: Managed by TanStack Table (`rowSelection` state)
- **URL Sync**: Synced to `?uuid=<rowId>` query param
- **Limitation**: Single selection (`enableMultiRowSelection: false`)

#### 2. **Checked Rows** (`checkedRows`)
- **Purpose**: Multi-select for bulk actions (favorite, compare, deploy)
- **State**: Independent local state in `ModelsDataTableInfinite`
- **Persistence**: Not synced to URL (ephemeral)
- **Cleanup**: Auto-cleaned when rows scroll out of view

```typescript
// models-data-table-infinite.tsx:133-143
const [checkedRows, setCheckedRows] = React.useState<Record<string, boolean>>({});
const toggleCheckedRow = React.useCallback((rowId: string, next?: boolean) => {
  setCheckedRows((prev) => {
    const shouldCheck = typeof next === "boolean" ? next : !prev[rowId];
    if (shouldCheck) return { ...prev, [rowId]: true };
    const { [rowId]: _omit, ...rest } = prev;
    return rest;
  });
}, []);
```

**Why Separate?**
- Allows selecting a row for details while checking others for bulk actions
- Prevents accidental navigation when checking multiple rows
- Better UX: selection = view details, checkboxes = bulk actions

---

## Cross-Tab Synchronization

### BroadcastChannel Implementation

```typescript
// models-client.tsx:134-203
React.useEffect(() => {
  if (!isFavoritesMode) return;
  const bc = new BroadcastChannel(MODEL_FAVORITES_BROADCAST_CHANNEL);
  
  bc.onmessage = async (event) => {
    if (event.data?.source === broadcastId) return;  // Prevent echo
    
    const newFavorites = event.data.favorites as ModelFavoriteKey[];
    syncModelFavorites({ queryClient, favorites: newFavorites });
    
    // Update rows cache
    // - Remove deleted favorites
    // - Fetch and add new favorites
  };
  
  return () => bc.close();
}, [broadcastId, fetchFavoriteRowsByKeys, isFavoritesMode, queryClient]);
```

**Flow:**
1. Tab A adds/removes favorite → broadcasts message
2. Tab B receives message → updates React Query cache
3. Tab B updates rows cache (adds/removes rows)
4. Tab B UI updates automatically (React Query reactivity)

**Source Tracking:**
- Each tab generates unique `broadcastId` (via `getFavoritesBroadcastId()`)
- Prevents echo loops (tab ignores its own broadcasts)

---

## Error Handling & Resilience

### API Error Handling

```typescript
// models-checked-actions-island.tsx:302-337
catch (error) {
  // Rollback optimistic update
  queryClient.setQueryData(MODEL_FAVORITES_QUERY_KEY, originalFavorites);
  setLocalFavorites(originalFavorites);
  void queryClient.invalidateQueries({ queryKey: ["model-favorites", "rows"] });
  
  // Handle specific errors
  if (error instanceof ModelFavoritesAPIError) {
    if (error.status === 401) promptForAuth();
    if (error.status === 429) showFavoritesNotice("Rate limit exceeded");
    if (error.code === "TIMEOUT") showFavoritesNotice("Server took too long");
  }
}
```

### Error Types
- **401 Unauthorized**: Prompts sign-in dialog
- **429 Rate Limit**: Shows retry message
- **408 Timeout**: Shows timeout message (10s timeout)
- **Network Errors**: Generic failure message

### Resilient Features
- **Optimistic Updates**: Immediate UI feedback
- **Rollback on Error**: Automatic state restoration
- **Cache Invalidation**: Forces refetch on failure
- **Graceful Degradation**: Falls back to empty state if favorites fail to load

---

## Performance Optimizations

### 1. **Chunked Row Fetching**
```typescript
const FAVORITES_CHUNK_SIZE = 200;
// Fetches rows in batches to avoid large payloads
```

### 2. **Stale-Time Configuration**
```typescript
staleTime: Infinity,  // Favorites rarely change
refetchOnWindowFocus: false,
refetchOnReconnect: false,
refetchOnMount: false,
```

### 3. **Placeholder Data**
```typescript
placeholderData: (previous) => previous ?? [],
// Prevents loading states when switching modes
```

### 4. **Memoized Computations**
- `favoriteKeys`: Memoized Set from favorites array
- `favoriteStatus`: Memoized calculation of add/remove state
- `visibleRowIds`: Memoized Set for checked rows validation

### 5. **Cache-First Strategy**
- Server-side cache → Database fallback
- Reduces database queries for frequently accessed favorites

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/app/llms/page.tsx` | Server component, determines favorites mode, loads initial keys |
| `src/components/models-table/models-client.tsx` | Orchestrates favorites mode, manages queries |
| `src/components/models-table/models-data-table-infinite.tsx` | Table component, manages checkedRows state |
| `src/components/models-table/models-checked-actions-island.tsx` | UI for favorite actions, handles mutations |
| `src/app/api/models/favorites/route.ts` | API endpoints (GET/POST/DELETE) |
| `src/app/api/models/favorites/rows/route.ts` | Endpoint to fetch model rows by favorite keys |
| `src/lib/model-favorites/api-client.ts` | Client-side API wrapper with error handling |
| `src/lib/model-favorites/cache.ts` | Cache-first favorites fetching |
| `src/lib/model-favorites/sync.ts` | Utility to sync favorites across state |
| `src/lib/model-favorites/broadcast.ts` | BroadcastChannel ID generation |
| `src/components/models-table/stable-key.ts` | Stable key generation for model identification |

---

## Usage Patterns

### Checking if a Row is Favorited
```typescript
const favoriteKeys = new Set(localFavorites ?? []);
const isFavorited = favoriteKeys.has(stableModelKey(row));
```

### Adding Favorites
```typescript
const toAdd = selectedRowIds
  .map(id => stableModelKey(table.getRow(id).original))
  .filter(key => !favoriteKeys.has(key));

await addModelFavorites(toAdd);
```

### Switching to Favorites Mode
```typescript
// User navigates to: /llms?favorites=true
// Automatically loads and displays only favorited models
```

---

## Potential Issues & Considerations

### 1. **Race Conditions**
- Multiple tabs adding/removing simultaneously
- **Mitigation**: BroadcastChannel + source tracking prevents conflicts

### 2. **Stale Favorite Keys**
- If a model is deleted/renamed, favorite keys may become orphaned
- **Mitigation**: `getFavoriteModelRows()` filters out missing models

### 3. **Large Favorite Lists**
- Loading all favorites at once could be slow for users with 1000+ favorites
- **Current**: No pagination in favorites mode (all loaded)
- **Consideration**: May need pagination for very large lists

### 4. **Checkbox State Persistence**
- Checked rows are cleared when scrolling out of view
- **Design**: Intentional (ephemeral state for bulk actions)

### 5. **Missing Row IDs**
- Falls back to index-based IDs if rows lack stable IDs
- **Warning**: Logged in dev mode; may cause favorites sync issues

---

## Summary

The favorites mechanism is a sophisticated, multi-layered system that:

1. **Stores favorites** in PostgreSQL with Redis caching
2. **Identifies models** via stable keys (id or provider:slug)
3. **Synchronizes** across tabs using BroadcastChannel
4. **Updates optimistically** with rollback on errors
5. **Filters views** via favorites mode (`?favorites=true`)
6. **Manages state** through React Query with infinite staleTime
7. **Handles errors** gracefully with user-friendly messages
8. **Optimizes performance** via chunking, caching, and memoization

The system is designed for reliability, performance, and user experience, with careful attention to edge cases and error scenarios.

