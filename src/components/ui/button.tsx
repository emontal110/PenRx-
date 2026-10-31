import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "success"
    | "soft";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 select-none cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40";

    const variants: Record<string, string> = {
      primary:
        "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black shadow-lg shadow-emerald-950/40 hover:shadow-emerald-900/60 border border-emerald-400/30",
      secondary:
        "bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 border border-slate-700/80 shadow-sm hover:border-slate-600",
      outline:
        "bg-transparent hover:bg-slate-800/60 text-slate-200 border border-slate-700/80 hover:border-slate-500",
      ghost:
        "bg-transparent hover:bg-slate-800/50 text-slate-300 hover:text-slate-100",
      danger:
        "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/40 border border-rose-500/30",
      success:
        "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 border border-emerald-500/30",
      soft:
        "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20",
    };

    const sizes: Record<string, string> = {
      xs: "px-2.5 py-1 text-xs gap-1.5 rounded-lg",
      sm: "px-3 py-1.5 text-xs sm:text-sm gap-1.5 rounded-lg",
      md: "px-4 py-2.5 text-sm gap-2 rounded-xl",
      lg: "px-6 py-3.5 text-base gap-2.5 rounded-2xl",
      icon: "w-9 h-9 sm:w-10 sm:h-10 p-0 flex items-center justify-center rounded-xl",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

