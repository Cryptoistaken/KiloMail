// ── FlickeringBg — permanent theme-aware background ───────────────────────
// Full-screen flickering grid that sits above panel bg washes but below content.

import { FlickeringGrid } from "@/components/ui/flickering-grid"
import { useTheme } from "@/lib/useTheme"

export function FlickeringBg() {
  const theme = useTheme()
  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      <FlickeringGrid
        className="h-full w-full"
        squareSize={5}
        gridGap={4}
        color={theme === "dark" ? "rgb(180, 180, 210)" : "rgb(60, 60, 90)"}
        maxOpacity={theme === "dark" ? 0.18 : 0.13}
        flickerChance={0.03}
      />
    </div>
  )
}
