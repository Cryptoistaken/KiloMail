"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { flushSync } from "react-dom"
import { cn } from "@/lib/utils"

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number
  /** Set to true when this toggler is already inside a <button> (e.g. DockIcon).
   *  Renders a <div> instead of <button> to avoid invalid nested interactive elements. */
  asDiv?: boolean
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  asDiv = false,
  ...props
}: AnimatedThemeTogglerProps) => {
  const [isDark, setIsDark] = useState(false)
  const elRef = useRef<HTMLButtonElement | HTMLDivElement>(null)

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"))
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
      const next = !isDark
      setIsDark(next)
      document.documentElement.classList.toggle("dark", next)
      localStorage.setItem("theme", next ? "dark" : "light")
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
  }, [isDark, duration])

  const content = (
    <>
      {isDark ? <Sun className="h-[18px] w-[18px] shrink-0" /> : <Moon className="h-[18px] w-[18px] shrink-0" />}
      <span className="sr-only">Toggle theme</span>
    </>
  )

  if (asDiv) {
    return (
      <div
        ref={elRef as React.Ref<HTMLDivElement>}
        onClick={toggleTheme}
        role="button"
        tabIndex={0}
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
      className={cn(className)}
      {...props}
    >
      {content}
    </button>
  )
}
