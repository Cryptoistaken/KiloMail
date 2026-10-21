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
  /** true = the user may type the local part. false = the provider assigns it (random or
   *  session-bound), so the UI locks the username field and generates one instead.
   *  Omitted behaves as editable, matching the original providers. */
  customUsername?: boolean
  generateUsername?(domain: string): string
  createEmail?(domain: string): Promise<string>
  matchDomain?(email: string): boolean
}
