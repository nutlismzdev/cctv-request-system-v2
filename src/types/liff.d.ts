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
  login(): void
  getFriendship(): Promise<LiffFriendship>
  getDecodedIDToken(): LiffDecodedIdToken
  getProfile(): Promise<LiffUserProfile>
  openWindow?(args: { url: string; external?: boolean }): void
  closeWindow(): void
}

declare global {
  interface Window {
    liff?: LiffSDK
  }
}
