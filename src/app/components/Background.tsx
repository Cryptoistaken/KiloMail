import { FlickeringGrid } from '@/components/ui/flickering-grid'
import { useTheme } from '@/hooks/useTheme'

/** Revyl's hero ramp, folded so it peaks mid-screen and returns to black. */
const HORIZON =
  'linear-gradient(180deg,#0a0a0a 0%,#12101f 22%,#1f1938 38%,#2b185b 52%,#4b2ea8 64%,#6239d0 72%,#2b185b 84%,#0a0a0a 100%)'

/** The light theme's violet, laid over a white page so the app is not just white. */
const WASH_LIGHT =
  'linear-gradient(180deg, rgba(107,87,245,0.26) 0%, rgba(107,87,245,0.12) 30%, rgba(107,87,245,0.03) 60%, rgba(255,255,255,0) 100%)'

export function Background() {
  const theme = useTheme()
  const is3d = theme === '3d'
  const is3l = theme === '3l'
  const is3 = is3d || is3l

  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      {is3d && (
        <>
          {/* Violet horizon */}
          <div className="absolute inset-0 opacity-90" style={{ backgroundImage: HORIZON }} />
          {/* Halo behind the header, so app screens carry the same light */}
          <div
            className="absolute inset-x-0 top-0 h-[440px]"
            style={{ backgroundImage: 'radial-gradient(70% 100% at 50% 0%, rgba(107,87,245,0.35) 0%, rgba(107,87,245,0) 70%)' }}
          />
          {/* Scrims: keeps the nav and dock readable over the glow */}
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background via-background/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </>
      )}
      {is3l && (
        <>
          {/* Violet wash from the top, so the inbox reads as the same product */}
          <div className="absolute inset-0" style={{ backgroundImage: WASH_LIGHT }} />
          <div
            className="absolute inset-x-0 bottom-0 h-[60%]"
            style={{ backgroundImage: 'radial-gradient(70% 100% at 50% 100%, rgba(107,87,245,0.16) 0%, rgba(107,87,245,0) 70%)' }}
          />
        </>
      )}
      {!is3 && (
        <FlickeringGrid
          className="h-full w-full"
          squareSize={5}
          gridGap={4}
          color={theme === 'dark' ? 'rgb(180, 180, 210)' : 'rgb(60, 60, 90)'}
          maxOpacity={theme === 'dark' ? 0.18 : 0.13}
          flickerChance={0.03}
        />
      )}
    </div>
  )
}
