import type { ReactNode } from 'react';
import { AiIntelligenceLayout } from '@/components/ai-search-intelligence/shell/AiIntelligenceLayout';

export default function IntelligenceLayout({ children }: { children: ReactNode }) {
	return <AiIntelligenceLayout>{children}</AiIntelligenceLayout>;
}
