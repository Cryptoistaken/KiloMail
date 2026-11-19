"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Layers, Moon, Sun } from "lucide-react"
import { flushSync } from "react-dom"
import { cn } from "@/lib/utils"
import type { Theme } from "@/hooks/useTheme"

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number
  asDiv?: boolean
}

const NEXT: Record<Theme, Theme> = { light: "dark", dark: "3d", "3d": "light" }
const LABEL: Record<Theme, string> = {
  light: "Switch to dark theme",
  dark: "Switch to 3D theme",
  "3d": "Switch to light theme",
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  asDiv = false,
  ...props
}: AnimatedThemeTogglerProps) => {
  const [theme, setTheme] = useState<Theme>("light")
  const elRef = useRef<HTMLButtonElement | HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const c = document.documentElement.classList
      setTheme(c.contains("theme3d") ? "3d" : c.contains("dark") ? "dark" : "light")
    }
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  const toggleTheme = useCallback(() => {
    const el = elRef.current
    if (!el) return

    const { top, left, width, height } = el.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const vw = window.visualViewport?.width ?? window.innerWidth
    const vh = window.visualViewport?.height ?? window.innerHeight
    const maxRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y))

    const applyTheme = () => {
      const next = NEXT[theme]
      setTheme(next)
      const root = document.documentElement
      // 3D rides on top of dark so every `dark:` utility still applies.
      root.classList.toggle("dark", next !== "light")
      root.classList.toggle("theme3d", next === "3d")
      localStorage.setItem("theme", next)
    }

    if (typeof document.startViewTransition !== "function") {
      applyTheme()
      return
    }

    const transition = document.startViewTransition(() => { flushSync(applyTheme) })
    transition?.ready?.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`] },
        { duration, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
      )
    })
  }, [theme, duration])

  const content = (
    <>
      {theme === "light" && <Moon className="h-[18px] w-[18px] shrink-0" />}
      {theme === "dark" && <Layers className="h-[18px] w-[18px] shrink-0" />}
      {theme === "3d" && <Sun className="h-[18px] w-[18px] shrink-0" />}
      <span className="sr-only">{LABEL[theme]}</span>
    </>
  )

  if (asDiv) {
    return (
      <div
        ref={elRef as React.Ref<HTMLDivElement>}
        onClick={toggleTheme}
        role="button"
        tabIndex={0}
        aria-label={LABEL[theme]}
        title={LABEL[theme]}
        onKeyDown={e => e.key === "Enter" && toggleTheme()}
        className={cn("cursor-pointer", className)}
      >
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      ref={elRef as React.Ref<HTMLButtonElement>}
      onClick={toggleTheme}
      aria-label={LABEL[theme]}
      title={LABEL[theme]}
      className={cn(className)}
      {...props}
    >
      {content}
    </button>
  )
}
