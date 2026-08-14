/** `resend` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'action.resend': '重新发起',
} satisfies Record<string, string>

/** The resend namespace key union. */
export type ResendKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The failed-round re-run action's copy. */
    resend: ResendKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'action.resend': 'Re-run',
} satisfies Record<ResendKey, string>
