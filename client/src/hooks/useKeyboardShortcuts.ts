import { useCallback, useEffect } from 'react';

interface ShortcutMap {
    [key: string]: () => void;
}

export default function useKeyboardShortcuts(shortcuts: ShortcutMap) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();

        // Don't fire shortcuts when typing in inputs
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable) {
            // Only allow Escape inside inputs
            if (e.key !== 'Escape') return;
        }

        // Build key combo string
        const parts: string[] = [];
        if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
        if (e.shiftKey) parts.push('Shift');
        if (e.altKey) parts.push('Alt');
        parts.push(e.key);

        const combo = parts.join('+');

        if (shortcuts[combo]) {
            e.preventDefault();
            shortcuts[combo]();
        }
    }, [shortcuts]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}
