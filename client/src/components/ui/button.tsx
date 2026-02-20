import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "btn-primary",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "btn-secondary",
        secondary:
          "btn-secondary",
        ghost:
          "btn-ghost",
        link: "text-primary underline-offset-4 hover:underline",
        action: "bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600/20",
      },
      size: {
        default: "h-11 px-6 py-3 rounded-lg has-[>svg]:px-5",
        sm: "h-9 px-4 py-2 rounded-md gap-1.5 has-[>svg]:px-3",
        lg: "h-12 px-8 py-4 rounded-lg has-[>svg]:px-7",
        icon: "size-11 rounded-lg",
        "icon-sm": "size-9 rounded-md",
        "icon-lg": "size-12 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
