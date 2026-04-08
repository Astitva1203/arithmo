'use client';

import { useEffect } from 'react';

const FLAG_KEY = 'arithmo_sw_cleanup_done_v1';

export default function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(FLAG_KEY) === '1') return;

    const cleanup = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map(async (registration) => {
              try {
                await registration.unregister();
              } catch {
                // Ignore unregister errors.
              }
            })
          );
        }

        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys.map(async (key) => {
              try {
                await caches.delete(key);
              } catch {
                // Ignore cache delete errors.
              }
            })
          );
        }
      } catch {
        // Ignore cleanup errors.
      } finally {
        sessionStorage.setItem(FLAG_KEY, '1');
      }
    };

    cleanup();
  }, []);

  return null;
}
