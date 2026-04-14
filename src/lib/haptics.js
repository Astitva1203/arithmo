export async function triggerHaptic(style = 'Light') {
  if (typeof window === 'undefined') return;

  try {
    const capacitor = window.Capacitor;
    const platform = capacitor?.getPlatform?.();
    if (!capacitor || platform === 'web') return;

    const haptics = capacitor.Plugins?.Haptics;
    if (!haptics?.impact) return;

    await haptics.impact({ style });
  } catch {
    // Ignore haptic failures so web and desktop behavior remain unaffected.
  }
}
