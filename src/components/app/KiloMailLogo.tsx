// ── KiloMailLogo — uses real logo/favicon assets, switches on theme ────────
// dark mode  → dark_logo.svg / dark_favicon.svg
// light mode → white_logo.svg / white_favicon.svg
//
// Usage:
//   <KiloMailLogo />                  → icon only (favicon size)
//   <KiloMailLogo variant="logo" />   → full wordmark logo
//   <KiloMailLogo className="h-7" />  → custom size

import { useTheme } from "@/lib/useTheme"
import { cn } from "@/lib/utils"

interface LogoProps {
  /** "icon" = favicon square, "logo" = full wordmark. Default: "icon" */
  variant?: "icon" | "logo"
  className?: string
  alt?: string
}

export function KiloMailLogo({ variant = "icon", className, alt = "KiloMail" }: LogoProps) {
  const theme = useTheme()
  const isDark = theme === "dark"

  if (variant === "logo") {
    return (
      <img
        src={isDark ? "/dark_logo.svg" : "/white_logo.svg"}
        alt={alt}
        className={cn("h-7 w-auto", className)}
        draggable={false}
      />
    )
  }

  return (
    <img
      src={isDark ? "/dark_favicon.svg" : "/white_favicon.svg"}
      alt={alt}
      className={cn("h-7 w-7", className)}
      draggable={false}
    />
  )
}
