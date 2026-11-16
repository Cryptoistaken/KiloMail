import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import md5 from '@/lib/md5'
import { senderDomain, senderAddress } from '@/lib/sender'
import type { MessageMeta } from '@/lib/types'

const COLORS = [
  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400',
  'bg-orange-500/15 text-orange-600 dark:text-orange-400',
]

function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

type Who = Pick<MessageMeta, 'from'> & Partial<Pick<MessageMeta, 'fromName'>>

interface SenderAvatarProps extends Who {
  className?: string
}

/**
 * Sender picture, best effort, in three steps:
 *   1. the sender's real Gravatar photo (404 when they have none)
 *   2. the sender's website logo
 *   3. the letter avatar we always had
 * Gravatar needs the MD5 of the address; the logo comes from Google's favicon service, which
 * resolves any domain. Both are cross-origin images, so failures just advance the step.
 */
export function SenderAvatar({ from, fromName, className }: SenderAvatarProps) {
  const [step, setStep] = useState(0)
  useEffect(() => setStep(0), [from])

  const address = senderAddress(from).trim().toLowerCase()
  const domain = senderDomain(from)
  const letter = (fromName?.trim()?.[0] || address[0] || '?').toUpperCase()

  if (step === 0 && address.includes('@')) {
    return (
      <img
        key="gravatar"
        src={`https://www.gravatar.com/avatar/${md5(address)}?d=404&s=80`}
        alt=""
        loading="lazy"
        onError={() => setStep(domain ? 1 : 2)}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    )
  }

  if (step <= 1 && domain) {
    return (
      <img
        key="favicon"
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
        alt=""
        loading="lazy"
        onError={() => setStep(2)}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    )
  }

  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full font-bold', colorFor(from), className)}>
      {letter}
    </div>
  )
}
