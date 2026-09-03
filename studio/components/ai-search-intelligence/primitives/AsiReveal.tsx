'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAsiMotion } from '@/lib/ui/asi-motion';

export function AsiReveal({ children, className = '' }: { children: ReactNode; className?: string }) {
	const motionTokens = useAsiMotion();
	return (
		<motion.div
			className={className}
			variants={motionTokens.page}
			initial="hidden"
			animate="show"
		>
			{children}
		</motion.div>
	);
}

export function AsiRevealList({
	children,
	className = '',
	...rest
}: { children: ReactNode; className?: string } & Record<string, unknown>) {
	const motionTokens = useAsiMotion();
	return (
		<motion.div className={className} variants={motionTokens.list} initial="hidden" animate="show" {...rest}>
			{children}
		</motion.div>
	);
}

export function AsiRevealItem({ children, className = '' }: { children: ReactNode; className?: string }) {
	const motionTokens = useAsiMotion();
	return (
		<motion.div className={className} variants={motionTokens.item}>
			{children}
		</motion.div>
	);
}
