'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
// [TEMP] 미연동 회원 메뉴 — 요금제 · 히스토리 / AI 지식 그래프 검증 / AI 자율 운영 현황
// import { AutonomousMonitor } from '@/components/AutonomousMonitor';
// import { KnowledgeGraphPanel } from '@/components/KnowledgeGraphPanel';
import { MyPageDashboard, type MyPageDashboardTab } from '@/components/mypage/MyPageDashboard';

interface MypageSectionsProps {
	overview: ReactNode;
	initialDomain?: string | null;
	userName?: string;
	userEmail?: string;
	userId?: string;
}

type SectionId = 'workspace' | 'overview' | 'knowledge-graph' | 'autonomous';

const DISABLED_SECTION_TABS = ['overview', 'knowledge-graph', 'autonomous'] as const;

const SECTIONS: { id: SectionId; label: string }[] = [
	{ id: 'workspace', label: '문의 · 보관함' },
	// [TEMP] 미연동 회원 메뉴 — 추후 재활성화
	// { id: 'overview', label: '요금제 · 히스토리' },
	// { id: 'knowledge-graph', label: 'AI 지식 그래프 검증' },
	// { id: 'autonomous', label: 'AI 자율 운영 현황' },
];

function sectionFromTab(tab: string | null): { section: SectionId; workspaceTab: MyPageDashboardTab } {
	if (tab === 'scraps') return { section: 'workspace', workspaceTab: 'scraps' };
	if (tab === 'inquiries') return { section: 'workspace', workspaceTab: 'inquiries' };
	if (tab === 'password' || tab === 'security') return { section: 'workspace', workspaceTab: 'password' };
	// [TEMP] 미연동 탭은 기본 워크스페이스로 보냄
	// if (tab === 'overview' || tab === 'knowledge-graph' || tab === 'autonomous') {
	// 	return { section: tab, workspaceTab: 'inquiries' };
	// }
	return { section: 'workspace', workspaceTab: 'inquiries' };
}

export function MypageSections({
	overview: _overview,
	initialDomain: _initialDomain,
	userName = '회원',
	userEmail = '',
	userId = '',
}: MypageSectionsProps) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const initial = sectionFromTab(searchParams.get('tab'));
	const [section, setSection] = useState<SectionId>(initial.section);
	const [workspaceTab, setWorkspaceTab] = useState<MyPageDashboardTab>(initial.workspaceTab);

	useEffect(() => {
		const tab = searchParams.get('tab');
		if (tab && DISABLED_SECTION_TABS.includes(tab as (typeof DISABLED_SECTION_TABS)[number])) {
			const params = new URLSearchParams(searchParams.toString());
			params.set('tab', 'inquiries');
			router.replace(`${pathname}?${params.toString()}`, { scroll: false });
			setSection('workspace');
			setWorkspaceTab('inquiries');
			return;
		}
		const next = sectionFromTab(tab);
		setSection(next.section);
		setWorkspaceTab(next.workspaceTab);
	}, [pathname, router, searchParams]);

	function replaceTab(next: string) {
		const params = new URLSearchParams(searchParams.toString());
		params.set('tab', next);
		router.replace(`${pathname}?${params.toString()}`, { scroll: false });
	}

	function selectSection(next: SectionId) {
		setSection(next);
		replaceTab(next === 'workspace' ? workspaceTab : next);
	}

	function selectWorkspaceTab(next: MyPageDashboardTab) {
		setSection('workspace');
		setWorkspaceTab(next);
		replaceTab(next);
	}

	return (
		<div className="flex flex-col gap-6">
			{SECTIONS.length > 1 ? (
				<nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-white/10">
					{SECTIONS.map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={() => selectSection(item.id)}
							className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
								section === item.id
									? 'border-accent bg-accent text-white'
									: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
							}`}
						>
							{item.label}
						</button>
					))}
				</nav>
			) : null}

			{(section === 'workspace' || SECTIONS.length === 1) && (
				<MyPageDashboard
					userId={userId}
					userName={userName}
					userEmail={userEmail}
					activeTab={workspaceTab}
					onTabChange={selectWorkspaceTab}
				/>
			)}
			{/* [TEMP] 미연동 회원 섹션 — 추후 재활성화
			{section === 'overview' && overview}
			{section === 'knowledge-graph' && <KnowledgeGraphPanel initialDomain={initialDomain} allowDomainEdit />}
			{section === 'autonomous' && <AutonomousMonitor compact />}
			*/}
		</div>
	);
}
