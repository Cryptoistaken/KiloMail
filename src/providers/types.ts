// ── Provider plugin contract ───────────────────────────────────────────────
//
// Every email provider must export a default that satisfies this interface.
// The registry auto-discovers all files matching src/providers/*.provider.ts
// via import.meta.glob — no manual registration needed.

import type { MessageMeta, MessageFull } from "@/lib/types"

export interface ProviderPlugin {
  /** Unique identifier — used in URLs and config keys. */
  id: string

  /** Human-readable name shown in UI. */
  name: string

  /** All domains this provider handles e.g. ["tenwmail.com", "clowtmail.com"] */
  domains: string[]

  /**
   * Set false to disable without deleting the file.
   * Disabled providers are hidden from domain pickers and never matched.
   */
  enabled: boolean

  /**
   * One-shot fetch of the inbox message list.
   * Called on mount and on manual refresh.
   */
  fetchInbox(email: string): Promise<MessageMeta[]>

  /**
   * Start a live connection (SSE or polling interval).
   * Must call onUpdate whenever the inbox changes.
   * Must return a cleanup function that stops the connection.
   */
  streamInbox(
    email: string,
    onUpdate: (msgs: MessageMeta[]) => void,
    onStatusChange: (connected: boolean) => void,
  ): () => void

  /**
   * Fetch full message body (text + html).
   * Implementations should use msgCache internally or let the caller cache.
   */
  fetchMessage(email: string, meta: MessageMeta): Promise<MessageFull | null>

  /**
   * Delete a message. Optional — providers that don't support deletion omit this.
   * The UI hides the delete button when undefined.
   */
  deleteMessage?(email: string, id: string): Promise<void>

  /**
   * Generate a random username for this provider's domains.
   * Optional — falls back to the global randomUser() if omitted.
   */
  generateUsername?(domain: string): string
}
