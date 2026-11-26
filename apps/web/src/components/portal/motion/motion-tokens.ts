/** Durations in milliseconds; no physics or looping decorative motion. */
export const portalMotion = {
  press: 100,
  tab: 200,
  sheet: 280,
  feedback: 180,
  disclosure: 220,
  ease: [0.2, 0.8, 0.2, 1] as const,
} as const;

export const portalMotionSeconds = (ms: number) => ms / 1000;
