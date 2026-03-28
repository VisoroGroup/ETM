import React from 'react';
import { UserCircle } from 'lucide-react';

// Predefined gradient pairs for deterministic user colors
const AVATAR_GRADIENTS = [
    ['#3B82F6', '#06B6D4'], // blue → cyan
    ['#8B5CF6', '#EC4899'], // violet → pink
    ['#F59E0B', '#EF4444'], // amber → red
    ['#10B981', '#3B82F6'], // emerald → blue
    ['#EC4899', '#F97316'], // pink → orange
    ['#6366F1', '#8B5CF6'], // indigo → violet
    ['#14B8A6', '#22D3EE'], // teal → cyan
    ['#F97316', '#FBBF24'], // orange → amber
    ['#EF4444', '#F472B6'], // red → pink
    ['#06B6D4', '#6366F1'], // cyan → indigo
];

/**
 * Generates a consistent gradient pair for a given name string.
 * Same name will always get the same color.
 */
function getGradientForName(name: string): [string, string] {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32bit integer
    }
    const idx = Math.abs(hash) % AVATAR_GRADIENTS.length;
    return AVATAR_GRADIENTS[idx] as [string, string];
}

interface UserAvatarProps {
    name?: string | null;
    avatarUrl?: string | null;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
}

const SIZE_MAP = {
    xs: { container: 'w-6 h-6', text: 'text-[10px]', icon: 'w-4 h-4' },
    sm: { container: 'w-7 h-7', text: 'text-[11px]', icon: 'w-4 h-4' },
    md: { container: 'w-9 h-9', text: 'text-[13px]', icon: 'w-5 h-5' },
    lg: { container: 'w-14 h-14', text: 'text-xl', icon: 'w-7 h-7' },
};

export default function UserAvatar({ name, avatarUrl, size = 'md', className = '' }: UserAvatarProps) {
    const s = SIZE_MAP[size];

    // If we have a real avatar image
    if (avatarUrl) {
        return (
            <div className={`${s.container} rounded-full overflow-hidden flex-shrink-0 shadow-md ${className}`}>
                <img
                    src={avatarUrl}
                    alt={name || 'Avatar'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        // Fallback to initials if image fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.classList.add('avatar-fallback');
                    }}
                />
            </div>
        );
    }

    // No name at all — unassigned
    if (!name) {
        return (
            <div className={`${s.container} rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center text-navy-500 flex-shrink-0 ${className}`}>
                <UserCircle className={s.icon} />
            </div>
        );
    }

    // Initials with unique color
    const [from, to] = getGradientForName(name);
    const initial = name.charAt(0).toUpperCase();

    return (
        <div
            className={`${s.container} rounded-full flex items-center justify-center text-white ${s.text} font-bold shadow-md flex-shrink-0 ${className}`}
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        >
            {initial}
        </div>
    );
}
