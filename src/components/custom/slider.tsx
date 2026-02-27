// Props to https://github.com/shadcn-ui/ui/issues/885#issuecomment-2059600641

"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  thumbLabel?: string;
};

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, thumbLabel, ...props }, ref) => {
  const [isMounted, setIsMounted] = React.useState(false);
  const ariaLabel =
    thumbLabel ??
    ((props as Record<string, string | undefined>)["aria-label"] ??
      undefined);
  const min = typeof props.min === "number" ? props.min : 0;
  const max = typeof props.max === "number" ? props.max : 100;
  const range = Math.max(1e-12, max - min);
  const thumbSizePx = 16;
  const halfThumb = thumbSizePx / 2;
  const initialValue = Array.isArray(props.value) ? props.value : [min, max];

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-[5px] w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {!isMounted ? (
        initialValue.map((value, index) => {
          const numeric = typeof value === "number" ? value : min;
          const position = Math.max(0, Math.min(1, (numeric - min) / range));
          const percent = position * 100;
          const offset = halfThumb - (halfThumb * percent) / 50;
          return (
            <span
              key={`placeholder-${index}`}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 h-4 w-4 rounded-full border-2 border-primary bg-background"
              style={{
                left: `calc(${percent}% + ${offset}px)`,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })
      ) : null}
      {initialValue.map((_, index) => (
        <React.Fragment key={index}>
          <SliderPrimitive.Thumb
            aria-label={ariaLabel}
            className="block h-4 w-4 rounded-full border border-primary bg-background ring-offset-background transition-colors hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          />
        </React.Fragment>
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
