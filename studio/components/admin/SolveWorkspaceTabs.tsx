'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { SolveAuditSnapshot } from '@/lib/solve/types';
import { AiCmsCodeTab } from './solve/AiCmsCodeTab';
import { FileIssueTargetReport } from './solve/FileIssueTargetReport';
import { FilePatchTab } from './solve/FilePatchTab';
import { ProposalTab } from './solve/ProposalTab';

type SolveTabId = 'ai-cms' | 'file-patch' | 'proposal';

const TABS: { id: SolveTabId; step: string; label: string; description: string }[] = [
	{
		id: 'ai-cms',
		step: '1',
		label: 'AI 해결 & CMS 코드',
		description: '결함별 AI 해결안과 CMS 주입 코드 스니펫을 준비합니다.',
	},
	{
		id: 'file-patch',
		step: '2',
		label: '파일패치 & Git Diff',
		description: '파일 단위 패치와 Git Diff 미리보기를 구성합니다.',
	},
	{
		id: 'proposal',
		step: '3',
		label: '제안서 & 견적 출력',
		description: '고객 제안서와 견적 산출물을 생성합니다.',
	},
];

interface SolveWorkspaceTabsProps {
	audit: SolveAuditSnapshot;
	initialTab?: SolveTabId;
}

export function SolveWorkspaceTabs({ audit, initialTab = 'ai-cms' }: SolveWorkspaceTabsProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [tab, setTab] = useState<SolveTabId>(initialTab);

	const selectTab = useCallback(
		(next: SolveTabId) => {
			setTab(next);
			const params = new URLSearchParams(searchParams.toString());
			if (next === 'ai-cms') {
				params.delete('tab');
			} else {
				params.set('tab', next);
			}
			const qs = params.toString();
			router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
		},
		[pathname, router, searchParams],
	);

	return (
		<div className="flex flex-col gap-4">
			<nav
				className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-3"
				aria-label="해결 워크스페이스 탭"
			>
				{TABS.map((item) => {
					const active = tab === item.id;
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => selectTab(item.id)}
							aria-pressed={active}
							className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-center text-sm font-bold transition ${
								active
									? 'bg-slate-900 text-white shadow-sm'
									: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
							}`}
						>
							<span
								className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
									active ? 'bg-white text-slate-900' : 'bg-slate-200 text-slate-600'
								}`}
							>
								{item.step}
							</span>
							<span className="leading-tight">{item.label}</span>
						</button>
					);
				})}
			</nav>

			{tab === 'ai-cms' ? (
				<div className="flex flex-col gap-4">
					<AiCmsCodeTab
						issues={audit.issues}
						initialCms={audit.cmsType || 'WordPress'}
						auditId={audit.id}
					/>
					<FileIssueTargetReport audit={audit} rows={audit.fileIssueTargets} />
				</div>
			) : null}
			{tab === 'file-patch' ? (
				<FilePatchTab
					targetUrl={audit.targetUrl}
					collectedUrlPaths={audit.collectedUrlPaths}
					cmsTypeHint={audit.cmsType}
					issueCodes={audit.issues.map((i) => i.code || i.id || '').filter(Boolean)}
					siteName={
						audit.siteName ||
						(() => {
							try {
								return new URL(audit.targetUrl).hostname.replace(/^www\./, '');
							} catch {
								return undefined;
							}
						})()
					}
					pageMetas={audit.pageMetas}
					mainTitle={audit.mainTitle}
					mainDescription={audit.mainDescription}
					mainH1={audit.mainH1}
					industryType={audit.industryType}
					navItems={audit.navItems}
					footerText={audit.footerText}
					legalName={audit.legalName}
				/>
			) : null}
			{tab === 'proposal' ? <ProposalTab audit={audit} /> : null}
		</div>
	);
}
