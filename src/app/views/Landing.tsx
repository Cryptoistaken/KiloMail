import { Zap, Shield, Clock, Globe as GlobeIcon, RefreshCw, Sparkles, ArrowRight, Check, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Globe } from '@/components/ui/globe'
import { Meteors } from '@/components/ui/meteors'
import { DottedMap } from '@/components/ui/dotted-map'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import type { COBEOptions } from 'cobe'
import { DOMAIN } from '@/lib/types'
import { useTheme } from '@/hooks/useTheme'
import { navigate } from '@/hooks/useHashRoute'
import { Background } from '@/app/components/Background'
import { Logo } from '@/app/components/Logo'

const GLOBE_BASE: COBEOptions = {
  width: 800, height: 800, onRender: () => {},
  devicePixelRatio: 2, phi: 0, theta: 0.3,
  dark: 1, diffuse: 0.8,
  mapSamples: 16000, mapBrightness: 1.8,
  baseColor: [0.18, 0.18, 0.22],
  markerColor: [1, 1, 1],
  glowColor: [0.3, 0.3, 0.4],
  markers: [
    { location: [23.8103, 90.4125], size: 0.07 },
    { location: [40.7128, -74.006],  size: 0.08 },
    { location: [51.5074, -0.1278],  size: 0.06 },
    { location: [35.6762, 139.6503], size: 0.06 },
    { location: [1.3521,  103.8198], size: 0.05 },
    { location: [48.8566, 2.3522],   size: 0.05 },
    { location: [-33.8688,151.2093], size: 0.05 },
    { location: [37.7749,-122.4194], size: 0.07 },
  ],
}

const GLOBE_LIGHT: COBEOptions = {
  ...GLOBE_BASE, dark: 0, diffuse: 0.4, mapBrightness: 1.2,
  baseColor: [1, 1, 1], markerColor: [0.1, 0.1, 0.9], glowColor: [1, 1, 1],
}

const FEATURES = [
  { icon: <Zap className="h-4 w-4" />,       title: 'Instant delivery',  desc: 'Emails arrive in seconds via Cloudflare MX routing.' },
  { icon: <Shield className="h-4 w-4" />,    title: 'Zero sign-up',      desc: 'No account needed. Generate an inbox and start receiving.' },
  { icon: <Clock className="h-4 w-4" />,     title: 'Auto-expiry',       desc: 'Inbox self-destructs 10 minutes after last email.' },
  { icon: <GlobeIcon className="h-4 w-4" />, title: 'Live stream',       desc: 'Real-time SSE — no polling, no page refreshes.' },
  { icon: <RefreshCw className="h-4 w-4" />, title: 'Auto-regenerate',   desc: 'Generate a fresh address any time with one click.' },
  { icon: <Sparkles className="h-4 w-4" />,  title: 'Open source',       desc: 'MIT licensed. Self-host on Vercel + Upstash in minutes.' },
]

const TRUST = ['kilolabs.space domain', 'Cloudflare MX', 'Upstash Redis', 'Vercel Edge']

interface LandingProps { onLaunch: () => void }

export function Landing({ onLaunch }: LandingProps) {
  const theme = useTheme()
  return (
    <TooltipProvider>
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <Background />
        <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
          <Meteors number={14} />
        </div>
        <div className="absolute inset-0 z-[1] opacity-[0.10] pointer-events-none">
          <DottedMap dotRadius={0.18} mapSamples={2500} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center overflow-hidden" style={{ height: '70vh' }}>
          <div className="relative w-full max-w-3xl">
            <Globe className="bottom-0 left-1/2 -translate-x-1/2 opacity-80"
              config={theme === 'dark' ? GLOBE_BASE : GLOBE_LIGHT} />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-40 bg-gradient-to-b from-background to-transparent" />
        <div className="relative z-[4] flex flex-1 flex-col">
          <nav className="flex items-center justify-between px-6 pt-5">
            <div className="flex items-center gap-2">
              <Logo variant="icon" className="h-7 w-7 sm:hidden" />
              <Logo variant="logo" className="hidden h-5 sm:block" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/docs')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <BookOpen className="h-3.5 w-3.5" /> Docs
              </button>
              <AnimatedThemeToggler className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-muted transition-colors" />
            </div>
          </nav>
          <main className="flex flex-1 flex-col items-center justify-center px-4 pt-16 pb-16 text-center">
            <Badge variant="outline" className="mb-8 gap-1.5 border-border/60 px-3 py-1 text-xs tracking-wide">
              <Zap className="h-3 w-3 text-primary" />
              Real-time · SSE · Cloudflare Edge
            </Badge>
            <h1 className="max-w-3xl text-[clamp(2.8rem,6vw,4.5rem)] font-extrabold leading-[1.08] tracking-[-0.03em]">
              <span className="bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                Disposable email
              </span>
              <span className="text-foreground">,</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-foreground/80 to-muted-foreground bg-clip-text text-transparent">
                done right.
              </span>
            </h1>
            <p className="mt-6 max-w-[480px] text-[1.05rem] leading-relaxed text-muted-foreground">
              KiloMail gives you a live, auto-expiring inbox at{' '}
              <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                @{DOMAIN}
              </code>
              . No sign-up. No tracking. Just mail.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" onClick={onLaunch} className="h-11 gap-2 px-6 text-sm font-semibold shadow-lg shadow-primary/20">
                Open Inbox <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={onLaunch} className="h-11 px-6 text-sm font-medium">
                Generate address
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-xs text-muted-foreground/70">
              {TRUST.map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-emerald-500/80" /> {t}
                </span>
              ))}
            </div>
          </main>
          <section className="relative mx-auto w-full max-w-4xl px-4 pb-[38vh]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-background/60 p-5 backdrop-blur-md transition-all hover:border-primary/30 hover:bg-background/80 hover:shadow-sm">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/80 text-foreground/80">
                    {f.icon}
                  </div>
                  <h3 className="mb-1 text-sm font-semibold tracking-tight">{f.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </TooltipProvider>
  )
}
