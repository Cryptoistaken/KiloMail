import type { MessageMeta, MessageFull } from "@/lib/types"

export interface ProviderPlugin {
  id: string
  name: string
  domains: string[]
  enabled: boolean
  fetchInbox(email: string): Promise<MessageMeta[]>
  streamInbox(
    email: string,
    onUpdate: (msgs: MessageMeta[]) => void,
    onStatusChange: (connected: boolean) => void,
  ): () => void
  fetchMessage(email: string, meta: MessageMeta): Promise<MessageFull | null>
  deleteMessage?(email: string, id: string): Promise<void>
  generateUsername?(domain: string): string
  createEmail?(domain: string): Promise<string>
  matchDomain?(email: string): boolean
}
