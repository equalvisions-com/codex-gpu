Reusable Column Components

This folder contains small, focused cells that can be reused inside any `columns.tsx` definition. Current exports:

- `DataTableColumnLatency`: renders a latency value with color-coded badge + tooltip metadata.
- `DataTableColumnRegion`: displays a region badge (emoji flag + name) with graceful fallbacks.
- `DataTableColumnStatusCode`: shows HTTP status codes with contextual colors.

Usage Example:

```tsx
"use client";

import { DataTableColumnLatency } from "@/components/data-table/data-table-column/data-table-column-latency";
import type { ColumnDef } from "@tanstack/react-table";

export type ColumnSchema = {
  latency_ms: number;
};

export const columns: ColumnDef<ColumnSchema>[] = [
  {
    accessorKey: "latency_ms",
    header: "Latency",
    cell: ({ row }) => {
      const value = row.getValue<number>("latency_ms") ?? 0;
      return <DataTableColumnLatency value={value} />;
    },
  },
];
```
