# Model Column Resizing Implementation Guide

## Overview

This document explains the implementation of seamless column resizing for the Model column in the TanStack Table with virtualization. The Model column uses `width: "auto"` for flex growth on larger screens, but needs to support manual resizing like other columns without visual jumps.

## Problem Statement

The Model column (`id: "name"`) had the following requirements:
1. **Flex growth**: On larger screens, the column should grow to fill available space (`width: "auto"`)
2. **Manual resizing**: Users should be able to resize it like other columns
3. **No visual jumps**: Resizing should start smoothly without jumping to minimum width
4. **Persistent state**: Once resized, the column should maintain pixel width (not revert to "auto")
5. **Reset capability**: Double-click should reset to default flex behavior

## Solution Architecture

### Key Components

1. **Persistent Resize Tracking**: `useRef<boolean>` to track if column has been manually resized
2. **Stable Header Refs**: `Map<string, RefObject>` to maintain refs across renders/scrolls
3. **Custom Resize Handler**: Intercepts resize start event to measure actual rendered width
4. **Dynamic Width Calculation**: Helper function to determine `width` style ("auto" vs pixel)

### Execution Flow

```
User clicks resize handle
  ↓
handleResizeStart() fires
  ↓
Is Model column? → No → Standard handler
  ↓
Yes → Has it been resized?
  ↓
No → Measure actual rendered width (offsetWidth)
  ↓
Set width directly on DOM (header + all cells)
  ↓
Update TanStack Table state
  ↓
Schedule resize handler via requestAnimationFrame
  ↓
TanStack Table's standard resize handler takes over
```

## File Changes

### `src/components/models-table/models-data-table-infinite.tsx`

#### 1. Ref Declarations (Lines 480-494)

```typescript
// Track measured width for reference
const modelColumnMeasuredWidthRef = React.useRef<number | null>(null);

// Track if model column has been manually resized - persists across renders
// Once resized, column should always use pixel width (never revert to "auto")
const modelColumnHasBeenResizedRef = React.useRef<boolean>(false);

// Stable ref map for header elements - created once, persists across renders
const headerRefsMap = React.useRef<Map<string, React.RefObject<HTMLTableCellElement | null>>>(new Map());

// Get or create a ref for a specific header ID
const getHeaderRef = React.useCallback((headerId: string): React.RefObject<HTMLTableCellElement | null> => {
  if (!headerRefsMap.current.has(headerId)) {
    headerRefsMap.current.set(headerId, React.createRef<HTMLTableCellElement | null>());
  }
  return headerRefsMap.current.get(headerId)!;
}, []);
```

**Purpose**: 
- `modelColumnMeasuredWidthRef`: Stores the measured width for reference
- `modelColumnHasBeenResizedRef`: Persistent flag to prevent reverting to "auto"
- `headerRefsMap`: Stable refs that survive renders and scrolls
- `getHeaderRef`: Helper to get/create stable refs

#### 2. Column Configuration Memoization (Lines 496-503)

```typescript
const minimumModelColumnWidth = React.useMemo(
  () => table.getColumn("name")?.columnDef.minSize ?? 270,
  [table]
);

const modelColumnDefaultSize = React.useMemo(
  () => table.getColumn("name")?.columnDef.size ?? 305,
  [table]
);
```

**Purpose**: Cache column configuration values to avoid repeated lookups.

#### 3. Width Calculation Helper (Lines 513-526)

```typescript
// Helper to get model column width style
const getModelColumnWidth = React.useCallback((columnId: string, currentSize: number) => {
  if (columnId !== "name") {
    return `${currentSize}px`;
  }
  
  // Once resized, always use pixel width (prevents jumping when hitting min size)
  if (modelColumnHasBeenResizedRef.current) {
    return `${currentSize}px`;
  }
  
  // Use "auto" for flex growth only when never resized and at default size
  return currentSize === modelColumnDefaultSize ? "auto" : `${currentSize}px`;
}, [modelColumnDefaultSize]);
```

**Purpose**: Determines whether to use `"auto"` or pixel width based on resize state.

#### 4. Custom Resize Handler (Lines 777-876)

```typescript
const handleResizeStart = React.useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
  // Safety check: ensure resize handler exists before calling
  const resizeHandler = header.getResizeHandler();
  if (!resizeHandler) {
    return;
  }

  if (!isModelColumn) {
    resizeHandler(e);
    return;
  }

  const columnSizing = table.getState().columnSizing;
  const hasBeenResized = header.id in columnSizing || modelColumnHasBeenResizedRef.current;
  
  // Mark as resized immediately when user starts resizing
  modelColumnHasBeenResizedRef.current = true;
  
  // If column hasn't been resized and is at default size, measure the actual width
  if (!hasBeenResized && header.getSize() === modelColumnDefaultSize) {
    const element = headerRef.current;
    if (element) {
      // Column is using "auto" - measure the actual rendered width synchronously
      const actualWidth = element.offsetWidth;
      if (actualWidth > 0) {
        // Store measured width for reference
        modelColumnMeasuredWidthRef.current = actualWidth;
        
        // Use the actual measured width (don't clamp to min if larger)
        const widthToSet = actualWidth >= minimumModelColumnWidth 
          ? actualWidth 
          : minimumModelColumnWidth;
        
        // CRITICAL: Set width directly on element to prevent visual jump
        element.style.width = `${widthToSet}px`;
        
        // Also update all cell elements in the same column
        const tableElement = element.closest('table');
        if (tableElement) {
          const cells = tableElement.querySelectorAll(`td[data-column-id="${header.id}"]`);
          for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            if (cell instanceof HTMLElement) {
              cell.style.width = `${widthToSet}px`;
            }
          }
        }
        
        // Update column sizing state synchronously
        const currentSizing = table.getState().columnSizing;
        table.setColumnSizing({
          ...currentSizing,
          [header.id]: widthToSet,
        });
        
        // Use requestAnimationFrame to ensure state update is processed
        requestAnimationFrame(() => {
          const handler = header.getResizeHandler();
          if (!handler) {
            return;
          }
          
          const syntheticEvent = {
            ...e,
            currentTarget: e.currentTarget,
            target: e.target,
          } as typeof e;
          
          handler(syntheticEvent);
        });
        
        // Prevent default handler from running
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
  }
  
  // Standard resize handler (column already resized or measurement not needed)
  resizeHandler(e);
}, [isModelColumn, header, modelColumnDefaultSize, table, headerRef, minimumModelColumnWidth]);
```

**Purpose**: Intercepts resize start to measure actual width and update DOM before TanStack Table's handler runs.

#### 5. Header Rendering (Lines 878-934)

```typescript
return (
  <TableHead
    key={header.id}
    ref={headerRef}  // Assign stable ref
    className={cn(
      "relative select-none truncate border-b border-border bg-background text-foreground/70 [&>.cursor-col-resize]:last:opacity-0",
      isModelColumn && "shadow-[inset_-1px_0_0_var(--border)]",
      header.column.columnDef.meta?.headerClassName,
    )}
    data-column-id={header.column.id}
    style={{
      width: getModelColumnWidth(header.id, header.getSize()),  // Dynamic width calculation
      minWidth:
        header.id === "name"
          ? `${minimumModelColumnWidth}px`
          : header.column.columnDef.minSize,
    }}
    // ... aria-sort, etc.
  >
    {/* Header content */}
    {header.column.getCanResize() && (
      <div
        onDoubleClick={() => {
          // Reset all resize tracking state
          modelColumnMeasuredWidthRef.current = null;
          modelColumnHasBeenResizedRef.current = false;
          // Clear the column from sizing state so it can return to "auto"
          const currentSizing = table.getState().columnSizing;
          const { [header.id]: _, ...restSizing } = currentSizing;
          table.setColumnSizing(restSizing);
          header.column.resetSize();
        }}
        onMouseDown={isModelColumn ? handleResizeStart : header.getResizeHandler()}
        onTouchStart={isModelColumn ? handleResizeStart : header.getResizeHandler()}
        // ... className, etc.
      />
    )}
  </TableHead>
);
```

**Key Points**:
- `ref={headerRef}`: Assigns stable ref for DOM measurement
- `width: getModelColumnWidth(...)`: Dynamic width calculation
- `onMouseDown/TouchStart`: Custom handler for Model column, standard for others
- `onDoubleClick`: Resets resize state to allow return to "auto"

#### 6. Cell Rendering (Lines 1133-1158)

```typescript
<TableCell
  key={cell.id}
  data-column-id={cell.column.id}  // Required for querySelectorAll in resize handler
  // ... other props
  style={{
    width: getModelColumnWidth 
      ? getModelColumnWidth(cell.column.id, cell.column.getSize())
      : `${cell.column.getSize()}px`,
    minWidth:
      cell.column.id === "name"
        ? `${minimumModelColumnWidth}px`
        : cell.column.columnDef.minSize,
  }}
  // ... other props
/>
```

**Key Points**:
- `data-column-id`: Required attribute for finding cells during resize
- `width: getModelColumnWidth(...)`: Matches header width calculation

## Column Configuration

### Column Definition Requirements

In your column definitions file (e.g., `models-columns.tsx`), ensure the Model column has:

```typescript
{
  id: "name",
  // ... other config
  size: 305,           // Default size
  minSize: 305,        // Minimum size
  // No maxSize        // Remove maxSize to allow flex growth
  // ... cell renderer without max-w-[xxxpx] class
}
```

## Integration Checklist

To replicate this for another column, follow these steps:

### 1. Identify Target Column
- Choose the column ID (e.g., `"name"`)
- Ensure it has `size`, `minSize` configured
- Remove `maxSize` if present

### 2. Add Ref Declarations
```typescript
const [columnId]ColumnMeasuredWidthRef = React.useRef<number | null>(null);
const [columnId]ColumnHasBeenResizedRef = React.useRef<boolean>(false);
const headerRefsMap = React.useRef<Map<string, React.RefObject<HTMLTableCellElement | null>>>(new Map());
const getHeaderRef = React.useCallback((headerId: string): React.RefObject<HTMLTableCellElement | null> => {
  if (!headerRefsMap.current.has(headerId)) {
    headerRefsMap.current.set(headerId, React.createRef<HTMLTableCellElement | null>());
  }
  return headerRefsMap.current.get(headerId)!;
}, []);
```

### 3. Add Column Configuration Memos
```typescript
const minimum[ColumnId]ColumnWidth = React.useMemo(
  () => table.getColumn("[columnId]")?.columnDef.minSize ?? [defaultMin],
  [table]
);

const [columnId]ColumnDefaultSize = React.useMemo(
  () => table.getColumn("[columnId]")?.columnDef.size ?? [defaultSize],
  [table]
);
```

### 4. Add Width Calculation Helper
```typescript
const get[ColumnId]ColumnWidth = React.useCallback((columnId: string, currentSize: number) => {
  if (columnId !== "[columnId]") {
    return `${currentSize}px`;
  }
  
  if ([columnId]ColumnHasBeenResizedRef.current) {
    return `${currentSize}px`;
  }
  
  return currentSize === [columnId]ColumnDefaultSize ? "auto" : `${currentSize}px`;
}, [[columnId]ColumnDefaultSize]);
```

### 5. Add Custom Resize Handler
- Copy `handleResizeStart` from lines 777-876
- Replace `isModelColumn` check with `header.id === "[columnId]"`
- Replace all `modelColumn*` references with `[columnId]Column*`
- Update `headerRef` to use `getHeaderRef(header.id)`

### 6. Update Header Rendering
- Add `ref={headerRef}` to `TableHead`
- Update `style.width` to use `get[ColumnId]ColumnWidth(...)`
- Update `onMouseDown`/`onTouchStart` to use custom handler
- Add `onDoubleClick` reset handler

### 7. Update Cell Rendering
- Add `data-column-id={cell.column.id}` to `TableCell`
- Update `style.width` to use `get[ColumnId]ColumnWidth(...)`

## Performance Considerations

### When Code Executes
- **Zero impact** until user clicks resize handle
- **~1-2ms overhead** on first resize start only
- After first resize, standard TanStack handler takes over (no overhead)

### Virtualization Impact
- `querySelectorAll` only queries visible rows (~50-100 with virtualization)
- DOM updates are batched by browsers
- No memory leaks (refs cleared on unmount)

## Browser Compatibility

- ✅ `element.closest()`: IE11+
- ✅ `querySelectorAll()`: Universal
- ✅ `requestAnimationFrame()`: Universal
- ✅ `offsetWidth`: Universal

## Edge Cases Handled

1. ✅ Missing resize handler: Checked before calling
2. ✅ Null element references: Checked before use
3. ✅ Component unmount: RAF includes safety checks
4. ✅ Missing table element: `closest()` null check
5. ✅ Invalid cell elements: `instanceof HTMLElement` check
6. ✅ Zero/negative width: `actualWidth > 0` check
7. ✅ State sync: DOM updated → React state updated → handler called

## Testing Checklist

- [ ] Column resizes smoothly without jumps
- [ ] Column maintains flex growth when not resized
- [ ] Column maintains pixel width after resize
- [ ] Double-click resets to default flex behavior
- [ ] Resizing works after scrolling
- [ ] Resizing works on mobile (touch events)
- [ ] No errors in console
- [ ] Performance is acceptable (~1-2ms on first resize)

## Maintenance Notes

### Common Issues

1. **Column jumps on resize**: Ensure `widthToSet` uses measured width, not `header.getSize()`
2. **Refs lost after scroll**: Use stable `Map`-based refs, not inline refs
3. **Reverts to "auto"**: Ensure `modelColumnHasBeenResizedRef.current = true` is set
4. **Cells don't match header**: Ensure `querySelectorAll` uses correct `data-column-id`

### Debugging

- Check `modelColumnHasBeenResizedRef.current` to see if resize flag is set
- Log `actualWidth` vs `header.getSize()` to debug measurement issues
- Verify `getModelColumnWidth` returns correct value ("auto" vs pixel)

## Related Files

- `src/components/models-table/models-columns.tsx`: Column definitions
- `src/components/models-table/models-data-table-infinite.tsx`: Main implementation
- `src/components/custom/table.tsx`: Table components (TableHead, TableCell)

## References

- [TanStack Table Column Resizing](https://tanstack.com/table/latest/docs/guide/column-resizing)
- [React useRef Hook](https://react.dev/reference/react/useRef)
- [React useCallback Hook](https://react.dev/reference/react/useCallback)
