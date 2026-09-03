import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ASI_CTA } from '@/lib/ui/asi-chrome';

export function AsiCta({
	children,
	className = '',
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
	return (
		<button type="submit" className={`${ASI_CTA} ${className}`.trim()} {...props}>
			{children}
		</button>
	);
}
