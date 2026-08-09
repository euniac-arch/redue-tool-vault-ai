'use client';

import { useState, type ReactNode } from 'react';
import { AutonomousMonitor } from '@/components/AutonomousMonitor';
import { KnowledgeGraphPanel } from '@/components/KnowledgeGraphPanel';

interface MypageSectionsProps {
	overview: ReactNode;
	initialDomain?: string | null;
}

type TabId = 'overview' | 'knowledge-graph' | 'autonomous';

export function MypageSections({ overview, initialDomain }: MypageSectionsProps) {
	const [tab, setTab] = useState<TabId>('overview');

	return (
		<div className="flex flex-col gap-6">
			<nav className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
				{(
					[
						{ id: 'overview' as const, label: '요금제 · 히스토리' },
						{ id: 'knowledge-graph' as const, label: 'AI 지식 그래프 검증' },
						{ id: 'autonomous' as const, label: 'AI 자율 운영 현황' },
					] as const
				).map((item) => (
					<button
						key={item.id}
						type="button"
						onClick={() => setTab(item.id)}
						className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
							tab === item.id
								? 'border-accent bg-accent text-white'
								: 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
						}`}
					>
						{item.label}
					</button>
				))}
			</nav>

			{tab === 'overview' && overview}
			{tab === 'knowledge-graph' && <KnowledgeGraphPanel initialDomain={initialDomain} allowDomainEdit />}
			{tab === 'autonomous' && <AutonomousMonitor compact />}
		</div>
	);
}
