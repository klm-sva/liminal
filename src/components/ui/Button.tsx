import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-certify-blue text-white hover:bg-certify-teal focus:ring-certify-blue shadow-md hover:shadow-lg hover:-translate-y-0.5",
        secondary:
          "bg-transparent text-certify-deep border-2 border-certify-deep hover:bg-certify-deep hover:text-certify-white focus:ring-certify-deep",
        ghost:
          "bg-transparent text-certify-deep hover:bg-certify-white focus:ring-certify-blue",
        danger:
          "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600",
        "dark-ghost":
          "bg-transparent text-white border border-white/20 hover:bg-white/10 focus:ring-white/30",
      },
      size: {
        sm:  "text-xs px-3.5 py-2",
        md:  "text-sm px-5 py-2.5",
        lg:  "text-base px-7 py-3.5",
        xl:  "text-base px-8 py-4",
        icon:"w-9 h-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
