import type { ReactNode } from 'react';
import { ASI_CHIP_ACTIVE, ASI_CHIP_IDLE, asiFocusRing } from '@/lib/ui/asi-chrome';

export function AsiFilterChip({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={onClick}
			className={asiFocusRing(active ? ASI_CHIP_ACTIVE : ASI_CHIP_IDLE)}
		>
			{children}
		</button>
	);
}
