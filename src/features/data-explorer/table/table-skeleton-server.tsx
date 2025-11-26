import { TableSkeleton } from "./table-skeleton";

// Server Component wrapper that renders immediately
// The Client Component skeleton will hydrate on the client
export function TableSkeletonServer() {
  return <TableSkeleton />;
}

