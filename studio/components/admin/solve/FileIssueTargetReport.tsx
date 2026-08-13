'use client';

import {
	FILE_ISSUE_BADGE_AUTO,
	FILE_ISSUE_BADGE_MANUAL,
	buildFileIssueTargetReportFromSnapshot,
	type FileIssueTargetRow,
} from '@/lib/solve/file-issue-report';
import type { SolveAuditSnapshot, SolveFileIssueTarget } from '@/lib/solve/types';

interface FileIssueTargetReportProps {
	audit: SolveAuditSnapshot;
	/** Optional precomputed rows (from mapAuditReportToSolveSnapshot). */
	rows?: SolveFileIssueTarget[] | FileIssueTargetRow[];
}

export function FileIssueTargetReport({ audit, rows }: FileIssueTargetReportProps) {
	const list: FileIssueTargetRow[] =
		rows && rows.length > 0
			? (rows as FileIssueTargetRow[])
			: buildFileIssueTargetReportFromSnapshot(audit);

	if (list.length === 0) {
		return (
			<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<h3 className="text-base font-bold text-slate-900">
					📄 개별 파일별 이슈 타겟 리포트
				</h3>
				<p className="mt-2 text-sm text-slate-500">
					스캔에서 파일 단위 Fail/Warn 이슈가 감지되지 않았습니다.
				</p>
			</section>
		);
	}

	const autoCount = list.filter((r) => r.fixStatus === 'auto').length;
	const manualCount = list.filter((r) => r.fixStatus === 'manual').length;

	return (
		<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="text-base font-bold text-slate-900">
						📄 개별 파일별 이슈 타겟 리포트
					</h3>
					<p className="mt-1 text-sm text-slate-600">
						스캔 시 발견된 오류를 파일 경로별로 식별합니다. v14 주입 후 스키마·alt는 JS/스키마
						엔진으로 자동 보완됩니다.
					</p>
				</div>
				<div className="flex flex-wrap gap-2 text-[11px] font-bold">
					<span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
						자동 {autoCount}
					</span>
					<span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
						수동 {manualCount}
					</span>
				</div>
			</div>

			<ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100">
				{list.map((row) => {
					const auto = row.fixStatus === 'auto';
					return (
						<li
							key={row.filePath}
							className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
						>
							<div className="min-w-0 flex-1">
								<code className="break-all font-mono text-sm font-semibold text-slate-900">
									{row.filePath}
								</code>
								<ul className="mt-1.5 flex flex-wrap gap-1.5">
									{row.issues.map((issue) => (
										<li
											key={issue}
											className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
										>
											{issue}
										</li>
									))}
								</ul>
							</div>
							<span
								className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-extrabold ${
									auto
										? 'border-emerald-200 bg-emerald-50 text-emerald-800'
										: 'border-amber-200 bg-amber-50 text-amber-900'
								}`}
								title={auto ? FILE_ISSUE_BADGE_AUTO : FILE_ISSUE_BADGE_MANUAL}
							>
								{row.badge || (auto ? FILE_ISSUE_BADGE_AUTO : FILE_ISSUE_BADGE_MANUAL)}
							</span>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
