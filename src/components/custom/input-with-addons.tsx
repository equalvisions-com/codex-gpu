import * as React from "react";
import { cn } from "@/lib/utils";

interface InputWithAddonsProps
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
        "border ring-offset-background focus-within:ring-ring group flex h-10 w-full rounded-md bg-background text-sm focus-within:outline-none focus-within:ring-none focus-within:ring-offset-none overflow-hidden",
        containerClassName
      )}
    >
      {leading ? (
        <div className="py-2 pl-2.5 bg-background">
          {leading}
        </div>
      ) : null}
      <input
        className={cn(
          "placeholder:text-muted-foreground bg-background w-[calc(100%/0.875)] rounded-md pl-2 pr-3 py-2 text-[16px] leading-[1] scale-[0.875] origin-left focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
