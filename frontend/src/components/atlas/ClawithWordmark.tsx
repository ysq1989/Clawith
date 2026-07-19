interface Props {
    /** Rendered height in px */
    height?: number;
    className?: string;
}

/**
 * Future Staff wordmark — "FS" letter mark in a gradient rounded square + "Future Staff" text.
 * The icon uses a fixed blue-purple gradient (#2563EB → #7C3AED).
 * The text color is controlled by the surrounding CSS `color` property (currentColor),
 * so theme switching (Paper Atlas ↔ Night Atlas) is automatic.
 */
export default function ClawithWordmark({ height = 32, className }: Props) {
    const iconSize = height;
    const textSize = height * 0.48;

    return (
        <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.25 }}
            className={className}
            aria-label="Future Staff"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width={iconSize}
                height={iconSize}
                viewBox="0 0 64 64"
                fill="none"
            >
                <defs>
                    <linearGradient id="fs-gradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#2563EB" />
                        <stop offset="100%" stopColor="#7C3AED" />
                    </linearGradient>
                </defs>
                <rect width="64" height="64" rx="14" fill="url(#fs-gradient)" />
                <text
                    x="32"
                    y="32"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontFamily="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    fontWeight="600"
                    fontSize="28"
                >
                    FS
                </text>
            </svg>
            <span
                style={{
                    color: 'currentColor',
                    fontSize: textSize,
                    fontWeight: 500,
                    lineHeight: 1,
                    letterSpacing: '-0.01em',
                }}
            >
                Future Staff
            </span>
        </span>
    );
}
