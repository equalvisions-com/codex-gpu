import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputWithAddonsProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  containerClassName?: string;
}

const InputWithAddons = React.forwardRef<
  HTMLInputElement,
  InputWithAddonsProps
>(({ leading, trailing, containerClassName, className, ...props }, ref) => {
  return (
    <div
      className={cn(
        "border ring-offset-background focus-within:ring-ring group flex h-10 w-full rounded-md border bg-transparent text-sm focus-within:outline-none focus-within:ring-none focus-within:ring-offset-none overflow-hidden",
        containerClassName
      )}
    >
      {leading ? (
        <div className="bg-muted/70 border-r px-3 py-2">
          {leading}
        </div>
      ) : null}
      <input
        className={cn(
          "placeholder:text-muted-foreground bg-background w-full rounded-md px-3 py-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
      {trailing ? (
        <div className="bg-muted/70 border-l px-3 py-2">
          {trailing}
        </div>
      ) : null}
    </div>
  );
});
InputWithAddons.displayName = "InputWithAddons";

export { InputWithAddons };
