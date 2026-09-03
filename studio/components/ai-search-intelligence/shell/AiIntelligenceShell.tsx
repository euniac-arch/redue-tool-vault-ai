'use client';

import type { ReactNode } from 'react';
import { AiIntelligenceLayout } from '@/components/ai-search-intelligence/shell/AiIntelligenceLayout';

/** @deprecated Use AiIntelligenceLayout from the /intelligence route layout. */
export function AiIntelligenceShell({ children }: { children: ReactNode; route?: unknown }) {
	return <AiIntelligenceLayout>{children}</AiIntelligenceLayout>;
}
