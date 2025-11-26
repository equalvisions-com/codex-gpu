"use client";

import * as React from "react";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { modelsColumns } from "./models-columns";
import { modelsColumnOrder, filterFields } from "./models-constants";
import { RowSkeletons } from "../table/_components/row-skeletons";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/custom/table";
import { DataTableColumnHeader } from "@/features/data-explorer/data-table/data-table-column-header";
import { DataTableProvider } from "@/features/data-explorer/data-table/data-table-provider";
import { SidebarSkeleton } from "../table/sidebar-skeleton";
import { MobileTopNav } from "../table/account-components";

const MINIMUM_MODEL_COLUMN_WIDTH = 200;

// Extract title from header function by checking common patterns
function getHeaderTitle(column: { id: string; columnDef: { header?: unknown } }): string {
  const header = column.columnDef.header;
  if (typeof header === "string") return header;
  
  // Common titles based on column IDs
  const titleMap: Record<string, string> = {
    blank: "",
    provider: "Provider",
    name: "Model",
    contextLength: "Context",
    maxCompletionTokens: "Max Output",
    throughput: "Throughput",
    modalities: "Modality",
    inputPrice: "Prompt",
    outputPrice: "Output",
  };
  
  return titleMap[column.id] ?? column.id;
}

export function ModelsTableSkeleton() {
  const table = useReactTable({
    data: [],
    columns: modelsColumns,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnOrder: modelsColumnOrder,
    },
  });

  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <DataTableProvider
      table={table}
      columns={modelsColumns}
      filterFields={filterFields}
      checkedRows={{}}
      setCheckedRows={() => {}}
      toggleCheckedRow={() => {}}
      columnFilters={[]}
      sorting={[]}
      rowSelection={{}}
      columnOrder={modelsColumnOrder}
      pagination={null}
      enableColumnOrdering={false}
      setColumnFilters={() => {}}
      setRowSelection={() => {}}
    >
      <div className="flex flex-col gap-2 sm:gap-4">
        {/* Mobile Header */}
        <div className="sm:hidden">
          <MobileTopNav
            user={null}
            onSignOut={() => {}}
            onSignIn={() => {}}
            onSignUp={() => {}}
            isSigningOut={false}
            renderSidebar={() => (
              <SidebarSkeleton filterFields={filterFields} showSearch={true} />
            )}
          />
        </div>
        
        {/* Grid Layout: Sidebar + Table */}
        <div className="grid h-full grid-cols-1 gap-0 sm:grid-cols-[13rem_1fr] md:grid-cols-[18rem_1fr]">
          {/* Sidebar Skeleton */}
          <SidebarSkeleton filterFields={filterFields} showSearch={false} currentPage="llms" />
          
          {/* Table Skeleton */}
          <div className="flex max-w-full flex-1 flex-col min-w-0">
            <div className="flex min-h-dvh w-full flex-col sm:flex-row pt-2 sm:p-0 border-0 md:border-l bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.map((column) => {
                      const title = getHeaderTitle(column);
                      return (
                        <TableHead
                          key={column.id}
                          style={{
                            width: column.getSize(),
                            minWidth: column.columnDef.minSize,
                          }}
                        >
                          {title ? (
                            <DataTableColumnHeader column={column} title={title} />
                          ) : (
                            <div className="flex justify-center">
                              <div className="h-4 w-4" />
                            </div>
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <RowSkeletons
                    table={table}
                    rows={50}
                    modelColumnWidth={`${MINIMUM_MODEL_COLUMN_WIDTH}px`}
                    primaryColumnId="name"
                  />
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </DataTableProvider>
  );
}

