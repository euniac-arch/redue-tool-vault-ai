'use client';

import { useState, type ReactNode } from 'react';
import { KnowledgeGraphPanel } from '@/components/KnowledgeGraphPanel';

interface PatchResultTabsProps {
	domain: string | null;
	overview: ReactNode;
}

type TabId = 'overview' | 'knowledge-graph';

export function PatchResultTabs({ domain, overview }: PatchResultTabsProps) {
	const [tab, setTab] = useState<TabId>('overview');

	return (
		<div className="flex flex-col gap-6">
			<nav className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
				{(
					[
						{ id: 'overview' as const, label: '패치 결과' },
						{ id: 'knowledge-graph' as const, label: 'AI 지식 그래프 검증' },
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

			{tab === 'overview' ? overview : <KnowledgeGraphPanel initialDomain={domain} />}
		</div>
	);
}
