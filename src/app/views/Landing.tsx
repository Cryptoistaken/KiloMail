import { Zap, Shield, Clock, Globe as GlobeIcon, RefreshCw, Sparkles, ArrowRight, Check, BookOpen, Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Meteors } from '@/components/ui/meteors'
import { DottedMap } from '@/components/ui/dotted-map'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import {  ALL_PROVIDERS } from '@/providers/registry'

// Own domains (the ones we host) — same source as the "Own" tab in the app.
const OWN_DOMAINS = ALL_PROVIDERS.filter(p => p.id === 'kilolabs').flatMap(p => p.domains)
import { navigate } from '@/hooks/useRoute'
import { useTheme } from '@/hooks/useTheme'
import { Background } from '@/app/components/Background'
import { Logo } from '@/app/components/Logo'

const FEATURES = [
  { icon: <Zap className="h-4 w-4" />,       title: 'Instant delivery',  desc: 'Emails arrive in seconds via Cloudflare MX routing.' },
  { icon: <Shield className="h-4 w-4" />,    title: 'Zero sign-up',      desc: 'No account needed. Generate an inbox and start receiving.' },
  { icon: <Clock className="h-4 w-4" />,     title: '30-day retention',  desc: 'Every message is kept for 30 days, then deleted automatically.' },
  { icon: <GlobeIcon className="h-4 w-4" />, title: 'Live stream',       desc: 'Real-time SSE — no polling, no page refreshes.' },
  { icon: <RefreshCw className="h-4 w-4" />, title: 'Auto-regenerate',   desc: 'Generate a fresh address any time with one click.' },
  { icon: <Sparkles className="h-4 w-4" />,  title: 'Open source',       desc: 'MIT licensed. Self-host on Vercel + Upstash in minutes.' },
]

const TRUST = [`${OWN_DOMAINS.length} own domains`, 'Cloudflare MX', 'Upstash Redis', 'Vercel Edge']

/** A still of the real inbox, so the hero shows the product instead of describing it. */
const PREVIEW = [
  { from: 'GitHub', subject: 'Verify your device', snippet: 'Use this code to finish signing in.', code: '481-920', time: '2s' },
  { from: 'Vercel', subject: 'Your login code', snippet: 'The code expires in ten minutes.', code: '941203', time: '12s' },
  { from: 'Notion', subject: 'Sign-in link for KiloMail', snippet: 'This link works once, for 15 minutes.', code: null, time: '34s' },
]

interface LandingProps { onLaunch: () => void }

export function Landing({ onLaunch }: LandingProps) {
  const theme = useTheme()
  const is3d = theme === '3d'

  return (
    <TooltipProvider>
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <Background />
        {/* Meteors and the dotted map are the flat themes' atmosphere; over the 3D horizon
            they read as scratches, so the grid does that job instead. */}
        {!is3d && (
          <>
            <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
              <Meteors number={14} />
            </div>
            <div className="absolute inset-0 z-[1] opacity-[0.10] pointer-events-none">
              <DottedMap dotRadius={0.18} mapSamples={1200} />
            </div>
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center overflow-hidden" style={{ height: '40vh' }}>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-40 bg-gradient-to-b from-background to-transparent" />
        <div className="relative z-[4] flex flex-1 flex-col">
          <header className="flex items-center justify-between px-6 pt-5">
            <div className="flex items-center gap-2">
              <Logo variant="icon" className="h-7 w-7 sm:hidden" />
              <Logo variant="logo" className="hidden sm:inline-flex" />
            </div>
            <nav className="flex items-center gap-3" aria-label="Site">
              <button onClick={() => navigate('/docs')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <BookOpen className="h-3.5 w-3.5" /> Docs
              </button>
              <AnimatedThemeToggler className="surface3d flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-muted transition-colors" />
            </nav>
          </header>
          <main>
            <div className="flex flex-col items-center px-4 pt-16 pb-10 text-center">
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
                KiloMail gives you a live inbox at{' '}
                {OWN_DOMAINS.map(d => (
                  <code key={d} className="mr-1 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                    @{d}
                  </code>
                ))}
                . No sign-up. No tracking. Just mail.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <div className="cta3d">
                  <Button size="lg" onClick={onLaunch} data-buzz="medium" className="h-11 gap-2 px-6 text-sm font-semibold shadow-lg shadow-primary/20">
                    Open Inbox <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button size="lg" variant="outline" onClick={onLaunch} data-buzz="medium" className="h-11 px-6 text-sm font-medium">
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
            </div>

            {/* The product, one scroll in — the frame is the 3D theme's violet hairline. */}
            <div className="frame3d mx-auto w-full max-w-3xl px-4">
              <div className="window3d overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-2xl shadow-black/10 backdrop-blur-sm">
                <div className="flex items-center gap-1.5 border-b border-border/60 px-4 py-2.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">kilomail.tech · inbox</span>
                  <span className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-500/90">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> live
                  </span>
                </div>
                <ul>
                  {PREVIEW.map(m => (
                    <li key={m.from} className="flex items-center gap-3 border-b border-border/50 px-4 py-3 text-left last:border-0">
                      <span className="icon3d flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/80 text-[11px] font-semibold text-foreground/80">
                        {m.from.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[13px] font-semibold">{m.from}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground/70">{m.time}</span>
                        </div>
                        <div className="truncate text-[12px] text-foreground/90">{m.subject}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{m.snippet}</div>
                      </div>
                      {m.code && (
                        <code className="shrink-0 rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] tracking-wider text-foreground">
                          {m.code}
                        </code>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <section className="relative mx-auto w-full max-w-4xl px-4 pt-20 pb-16">
              <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Why KiloMail
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map((f, i) => (
                  <div key={i} className="surface3d rounded-xl border border-border/60 bg-background/60 p-5 backdrop-blur-md transition-all hover:border-primary/30 hover:bg-background/80 hover:shadow-sm">
                    <div className="icon3d mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/80 text-foreground/80">
                      {f.icon}
                    </div>
                    <h2 className="mb-1 text-sm font-semibold tracking-tight">{f.title}</h2>
                    <p className="text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </main>

          <footer className="relative z-[4] mt-auto border-t border-border/50 px-6 py-7">
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2.5">
                <Logo variant="logo" className="hidden sm:inline-flex" />
                <Logo variant="icon" className="h-6 w-6 sm:hidden" />
                <span className="text-xs text-muted-foreground">Disposable email, done right.</span>
              </div>
              <nav className="flex items-center gap-5 text-xs" aria-label="Footer">
                <button onClick={() => navigate('/docs')} className="text-muted-foreground hover:text-foreground transition-colors">API docs</button>
                <a href="https://github.com/Cryptoistaken/KiloMail" target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <Github className="h-3.5 w-3.5" /> GitHub
                </a>
                <button onClick={onLaunch} className="text-muted-foreground hover:text-foreground transition-colors">Open inbox</button>
              </nav>
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  )
}
