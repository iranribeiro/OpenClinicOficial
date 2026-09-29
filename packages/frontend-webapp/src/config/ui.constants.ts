/**
 * Global client-side UI behavior, animation, and presentation constants.
 */
export const UI_CONFIG = {
  // Automatic feedback alert dismiss duration in seconds
  NOTIFICATION_AUTO_DISMISS_SECONDS: 5,

  // Automatic feedback alert dismiss duration in milliseconds
  get NOTIFICATION_AUTO_DISMISS_MS(): number {
    return this.NOTIFICATION_AUTO_DISMISS_SECONDS * 1000;
  },
} as const;

export type UiConfig = typeof UI_CONFIG;
