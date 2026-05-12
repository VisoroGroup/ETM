import { useEffect, useRef } from 'react';

/**
 * Common modal-dismiss behaviours (audit-3 H21–H24):
 *
 * - Esc closes the modal (was missing on every dialog/drawer).
 * - Focus is restored to the previously-focused element when the modal closes.
 *
 * Usage:
 *   useModalDismiss(open, onClose);
 *
 * Place this once at the top of any modal component. We deliberately do NOT
 * trap focus inside the modal (the codebase doesn't yet wire up focusable-
 * descendant lookup) — just providing Esc + focus-restore covers the keyboard
 * users who currently get stuck.
 */
export function useModalDismiss(open: boolean, onClose: () => void): void {
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return;

        previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey, true);

        return () => {
            document.removeEventListener('keydown', onKey, true);
            // Restore focus to the trigger after close. Wrapped in setTimeout
            // because some callers unmount the modal immediately on close and
            // the focus restore must happen after the unmount paints.
            const target = previouslyFocused.current;
            if (target && typeof target.focus === 'function') {
                setTimeout(() => target.focus(), 0);
            }
        };
    }, [open, onClose]);
}
