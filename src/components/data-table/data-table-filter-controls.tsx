"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/custom/accordion";
import * as React from "react";
import { DataTableFilterResetButton } from "./data-table-filter-reset-button";
import { DataTableFilterCheckbox } from "./data-table-filter-checkbox";
import { DataTableFilterSlider } from "./data-table-filter-slider";
import { DataTableFilterInput } from "./data-table-filter-input";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { cn } from "@/lib/utils";
import { ModalitiesFilter } from "@/components/models-table/modalities-filter";

interface DataTableFilterControlsProps {
  showSearch?: boolean;
}

export function DataTableFilterControls({
  showSearch = true,
}: DataTableFilterControlsProps = {}) {
  const { filterFields } = useDataTable();

  const searchFilter = filterFields?.find((field) => field.value === "search");
  const otherFilters = filterFields?.filter((field) => field.value !== "search");

  const defaultAccordionValues = React.useMemo(
    () =>
      otherFilters
        ?.filter(({ defaultOpen }) => defaultOpen)
        ?.map(({ value }) => value as string) ?? [],
    [otherFilters],
  );

  return (
    <>
      {showSearch && searchFilter && searchFilter.type === "input" ? (
        <div className="mb-6">
          <DataTableFilterInput {...searchFilter} />
        </div>
      ) : null}

      <Accordion type="multiple" defaultValue={defaultAccordionValues}>
        {otherFilters?.map((field) => {
          const value = field.value as string;
          return (
            <AccordionItem
              key={value}
              value={value}
              className="border-none mb-4 last:mb-0"
            >
              <AccordionTrigger className="w-full py-0 hover:no-underline data-[state=closed]:text-muted-foreground data-[state=open]:text-foreground focus-within:data-[state=closed]:text-foreground hover:data-[state=closed]:text-foreground [&>svg]:text-foreground/70">
                <div className="flex w-full items-center justify-between gap-2 truncate pb-2 pr-2">
                  <div className="flex items-center gap-2 truncate">
                    <p className="text-sm font-semibold text-foreground">{field.label}</p>
                  </div>
                  <DataTableFilterResetButton {...field} />
                </div>
              </AccordionTrigger>
              <AccordionContent className={cn(
                field.type === "slider" ? "[&>div]:pb-[2px]" : "[&>div]:pb-0"
              )}>
                <div
                  className={cn(
                    "p-0",
                    field.type === "slider" ? "pl-2 pr-0 pt-3 pb-0" : null,
                  )}
                >
                  {(() => {
                    if (value === "modalities") {
                      return <ModalitiesFilter />;
                    }

                    switch (field.type) {
                      case "checkbox": {
                        return <DataTableFilterCheckbox {...field} />;
                      }
                      case "slider": {
                        return <DataTableFilterSlider {...field} />;
                      }
                      case "input": {
                        return <DataTableFilterInput {...field} />;
                      }
                    }
                  })()}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );
}
