'use client';
import { useEffect } from 'react';

// Enhance an explicitly selected evidence preview. The standalone document
// keeps its native field-to-usage navigation, including without JavaScript.
export function SourceFieldFocus({ reference }: { reference: string }) {
  useEffect(() => {
    const target = document.getElementById(`source-selection-${reference}`) ?? document.getElementById('source-page-selection');
    if (!target) return;
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    target.focus({ preventScroll: true });
  }, [reference]);
  return null;
}
