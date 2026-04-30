// src/types/liff.d.ts

export interface LiffFriendship { friendFlag: boolean }
export interface LiffDecodedIdToken { sub: string }
export interface LiffUserProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}
export interface LiffSDK {
  init(options: { liffId: string }): Promise<void>
  isLoggedIn(): boolean
  isInClient(): boolean
  login(options?: { redirectUri?: string }): void
  getFriendship(): Promise<LiffFriendship>
  getDecodedIDToken(): LiffDecodedIdToken
  getProfile(): Promise<LiffUserProfile>
  getOS?(): string
  getVersion?(): string
  getLineVersion?(): string | null
  openWindow?(args: { url: string; external?: boolean }): void
  closeWindow(): void
}

declare global {
  interface Window {
    liff?: LiffSDK
  }
}
