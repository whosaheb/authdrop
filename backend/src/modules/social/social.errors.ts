/** Raised for any upstream/provider problem. The message is for logs only and never shown to end users. */
export class SocialAuthError extends Error {
  constructor(
    message: string,
    readonly reason: 'denied' | 'unverified_email' | 'invalid_state' | 'upstream' | 'disabled' = 'upstream',
  ) {
    super(message);
    this.name = 'SocialAuthError';
  }
}
