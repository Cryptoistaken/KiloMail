import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'icon' | 'logo'
  className?: string
  alt?: string
}

export function Logo({ variant = 'icon', className, alt = 'KiloMail' }: LogoProps) {
  const theme = useTheme()
  const isDark = theme === 'dark'

  if (variant === 'logo') {
    return (
      <img
        src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
        alt={alt}
        className={cn('h-7 w-auto', className)}
        draggable={false}
      />
    )
  }

  return (
    <img
      src={isDark ? '/favicon-dark.svg' : '/favicon-light.svg'}
      alt={alt}
      className={cn('h-7 w-7', className)}
      draggable={false}
    />
  )
}
