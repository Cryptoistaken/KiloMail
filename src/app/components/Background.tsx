import { FlickeringGrid } from '@/components/ui/flickering-grid'
import { useTheme } from '@/hooks/useTheme'

/** Revyl's hero ramp, folded so it peaks mid-screen and returns to black. */
const HORIZON =
  'linear-gradient(180deg,#0a0a0a 0%,#12101f 22%,#1f1938 38%,#2b185b 52%,#4b2ea8 64%,#6239d0 72%,#2b185b 84%,#0a0a0a 100%)'

const GRID =
  'linear-gradient(to right,rgba(255,255,255,0.07) 1px,transparent 1px),' +
  'linear-gradient(to bottom,rgba(255,255,255,0.07) 1px,transparent 1px)'

export function Background() {
  const theme = useTheme()
  const is3d = theme === '3d'

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
          {/* Engineering grid, faded at the edges */}
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage: GRID,
              backgroundSize: '72px 72px',
              maskImage: 'radial-gradient(90% 70% at 50% 58%, #000 20%, transparent 78%)',
              WebkitMaskImage: 'radial-gradient(90% 70% at 50% 58%, #000 20%, transparent 78%)',
            }}
          />
          {/* Scrims: keeps the nav and dock readable over the glow */}
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background via-background/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </>
      )}
      <FlickeringGrid
        className="h-full w-full"
        squareSize={5}
        gridGap={4}
        color={is3d ? 'rgb(200, 190, 255)' : theme === 'dark' ? 'rgb(180, 180, 210)' : 'rgb(60, 60, 90)'}
        maxOpacity={is3d ? 0.12 : theme === 'dark' ? 0.18 : 0.13}
        flickerChance={0.03}
      />
    </div>
  )
}
