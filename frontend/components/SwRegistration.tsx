'use client';

import { useEffect } from 'react';

export default function SwRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => console.warn('[SW] 등록 실패:', err));
    }
  }, []);

  return null;
}
