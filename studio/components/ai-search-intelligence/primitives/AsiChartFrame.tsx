import type { ReactNode } from 'react';

export function AsiChartFrame({ children, minHeight = 220 }: { children: ReactNode; minHeight?: number }) {
	return (
		<div className="min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch]">
			<div className="min-w-[16.5rem] sm:min-w-0" style={{ minHeight }}>
				{children}
			</div>
		</div>
	);
}
