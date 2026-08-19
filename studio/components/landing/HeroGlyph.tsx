import type { ReactNode } from 'react';

const SIZE = {
	sm: 'h-8 w-8 rounded-lg',
	md: 'h-10 w-10 rounded-xl',
} as const;

/** Shared purple icon chip used across the compact landing hero stack. */
export function HeroGlyph({
	children,
	size = 'sm',
}: {
	children: ReactNode;
	size?: keyof typeof SIZE;
}) {
	return (
		<span
			className={`inline-flex shrink-0 items-center justify-center border border-accent/35 bg-accent/15 text-accent dark:border-accent/40 dark:bg-accent/20 dark:text-accent-light ${SIZE[size]}`}
			aria-hidden
		>
			{children}
		</span>
	);
}
