import React, { type PropsWithChildren } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

export interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string
  children: React.ReactNode
  direction?: "top" | "middle" | "bottom"
}

const dockVariants = cva(
  "supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 mx-auto flex h-[58px] w-max items-center justify-center gap-2 rounded-2xl border p-2 backdrop-blur-md"
)

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    { className, children, direction = "middle", ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        {...props}
        className={cn(dockVariants({ className }), "dock-container", {
          "items-start": direction === "top",
          "items-center": direction === "middle",
          "items-end": direction === "bottom",
        })}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement<DockIconProps>(child) && child.type === DockIcon) {
            return React.cloneElement(child, { ...child.props })
          }
          return child
        })}
      </div>
    )
  }
)
Dock.displayName = "Dock"

export interface DockIconProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  children?: React.ReactNode
  props?: PropsWithChildren
}

const DockIcon = ({ className, children, ...props }: DockIconProps) => {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "dock-icon flex size-12 cursor-pointer items-center justify-center rounded-full transition-transform duration-200 ease-out hover:scale-125 active:scale-95",
        className
      )}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && props.onClick) { e.preventDefault(); (props.onClick as React.MouseEventHandler)(e as unknown as React.MouseEvent) } }}
      {...props}
    >
      <div className="flex h-full w-full items-center justify-center">
        {children}
      </div>
    </div>
  )
}
DockIcon.displayName = "DockIcon"

const dockIcon = "size-10"

export { Dock, DockIcon, dockVariants, dockIcon }
