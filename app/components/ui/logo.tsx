import * as React from "react"

import { cn } from "@/lib/utils"

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
}

export function Logo({ size = "md", className, ...props }: LogoProps) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl",
  }

  return (
    <div className={cn("font-bold text-primary", sizeClasses[size], className)} {...props}>
      <span className="text-primary">准望</span>
      <span className="text-secondary-900 dark:text-secondary-100">物联</span>
    </div>
  )
} 