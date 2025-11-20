import * as React from "react"

import { cn } from "@/lib/utils"

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-[calc(100%/0.875)] rounded-md border bg-background px-3 py-2 text-[16px] leading-[1] scale-[0.875] origin-left file:border-0 file:bg-transparent file:text-[16px] file:leading-[1] file:scale-[0.875] file:origin-left placeholder:text-foreground/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
