import type { ReactNode } from 'react';
import { ASI_TABLE_WRAP } from '@/lib/ui/asi-chrome';

export function AsiTableFrame({ children }: { children: ReactNode }) {
	return <div className={ASI_TABLE_WRAP}>{children}</div>;
}
