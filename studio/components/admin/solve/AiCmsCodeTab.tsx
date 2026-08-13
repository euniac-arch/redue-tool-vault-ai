'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	CMS_DISPLAY_OPTIONS,
	CMS_TAB_META,
	difficultyLabel,
	displayCmsToKey,
	getCmsHowTo,
	severityBadge,
	type SolveIssue,
} from '@/lib/solve/types';

interface AiCmsCodeTabProps {
	issues: SolveIssue[];
	initialCms?: string;
	auditId?: string;
}

function severityTone(severity: SolveIssue['severity']): string {
	if (severity === 'FAIL') return 'border-rose-200 bg-rose-50 text-rose-700';
	if (severity === 'WARN') return 'border-amber-200 bg-amber-50 text-amber-800';
	if (severity === 'PASS') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
	return 'border-slate-200 bg-slate-50 text-slate-600';
}

async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

function appliedStorageKey(auditId: string | undefined): string {
	return `redue_solve_applied_${auditId || 'session'}`;
}

export function AiCmsCodeTab({ issues, initialCms = 'WordPress', auditId }: AiCmsCodeTabProps) {
	const [preferredCms, setPreferredCms] = useState(initialCms);
	const [activeCmsByIssue, setActiveCmsByIssue] = useState<Record<number, string>>({});
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [applied, setApplied] = useState<Set<string>>(() => new Set());

	useEffect(() => {
		try {
			const raw = sessionStorage.getItem(appliedStorageKey(auditId));
			if (!raw) return;
			const list = JSON.parse(raw) as string[];
			if (Array.isArray(list)) setApplied(new Set(list));
		} catch {
			// ignore
		}
	}, [auditId]);

	function persistApplied(next: Set<string>) {
		setApplied(next);
		try {
			sessionStorage.setItem(appliedStorageKey(auditId), JSON.stringify([...next]));
		} catch {
			// ignore
		}
	}

	function issueKey(issue: SolveIssue, idx: number): string {
		return issue.id || issue.code || `${issue.title}-${idx}`;
	}

	function toggleApplied(key: string) {
		const next = new Set(applied);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		persistApplied(next);
	}

	const actionable = useMemo(() => issues.filter((i) => i.severity !== 'PASS'), [issues]);
	const prefKey = displayCmsToKey(preferredCms);
	const appliedCount = actionable.filter((issue, idx) => applied.has(issueKey(issue, idx))).length;

	return (
		<div className="flex flex-col gap-4">
			<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3 className="text-base font-bold text-slate-900">AI 해결 가이드 &amp; CMS 코드</h3>
						<p className="mt-1 text-sm text-slate-600">
							각 이슈별 <strong className="font-semibold text-slate-800">문제 요약 → 영향 → 단계별 조치 → 검증 방법</strong>과
							CMS별 삽입 코드를 제공합니다.
						</p>
					</div>
					{actionable.length > 0 ? (
						<span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
							적용 완료 {appliedCount}/{actionable.length}
						</span>
					) : null}
				</div>
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<label htmlFor="cms-pref-select" className="text-xs font-bold uppercase tracking-wide text-slate-500">
						주요 CMS 플랫폼
					</label>
					<select
						id="cms-pref-select"
						value={preferredCms}
						onChange={(e) => setPreferredCms(e.target.value)}
						className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-slate-400"
					>
						{CMS_DISPLAY_OPTIONS.map((cms) => (
							<option key={cms} value={cms}>
								{cms}
							</option>
						))}
					</select>
				</div>
			</div>

			{actionable.length === 0 ? (
				<div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
					조치가 필요한 이슈가 없습니다. SEO 상태가 양호합니다!
				</div>
			) : (
				<ul className="flex flex-col gap-4">
					{actionable.map((issue, idx) => {
						const key = issueKey(issue, idx);
						const isApplied = applied.has(key);
						const guide = issue.solutionGuide || {
							summary: issue.description || '',
							impact: issue.impactReason || '검색·AI 노출에 영향을 줄 수 있습니다.',
							difficulty: 'medium',
							steps: [],
							verify: [],
						};
						const cmsKeys = issue.cmsCode ? Object.keys(issue.cmsCode) : [];
						const activeCms =
							activeCmsByIssue[idx] || (cmsKeys.includes(prefKey) ? prefKey : cmsKeys[0] || prefKey);
						const tabMeta = CMS_TAB_META[activeCms] || CMS_TAB_META.nextjs;
						const codeContent = issue.cmsCode?.[activeCms] || '';
						const hasCode = Boolean(codeContent && !codeContent.includes('수정 --'));
						const copyKey = `cms-code-${idx}`;

						return (
							<li
								key={key}
								className={`rounded-xl border bg-white shadow-sm ${
									isApplied ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'
								}`}
							>
								<header className="border-b border-slate-100 px-5 py-4">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="flex flex-wrap items-center gap-2">
											<span className={`rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${severityTone(issue.severity)}`}>
												{severityBadge(issue.severity)}
											</span>
											<span className="text-xs font-semibold text-slate-500">{issue.category}</span>
											<span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
												{difficultyLabel(guide.difficulty)}
											</span>
											{issue.estMinutes ? (
												<span className="text-[11px] font-medium text-slate-500">약 {issue.estMinutes}분</span>
											) : null}
											{issue.code ? (
												<span className="rounded-md bg-slate-900/5 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
													{issue.code}
												</span>
											) : null}
										</div>
										<button
											type="button"
											onClick={() => toggleApplied(key)}
											className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
												isApplied
													? 'bg-emerald-600 text-white hover:bg-emerald-700'
													: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
											}`}
										>
											{isApplied ? '✓ 적용 완료' : '적용 완료로 표시'}
										</button>
									</div>
									<h4 className="mt-2 text-base font-bold text-slate-900">{issue.title}</h4>
									<p className="mt-1 text-sm leading-relaxed text-slate-600">{guide.summary || issue.description}</p>
								</header>

								<div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
									<div>
										<h5 className="text-xs font-bold uppercase tracking-wide text-slate-500">왜 중요한가요?</h5>
										<p className="mt-1.5 text-sm leading-relaxed text-slate-700">
											{guide.impact || issue.impactReason || '검색·AI 노출에 영향을 줄 수 있습니다.'}
										</p>
									</div>
									{issue.aiExplanation ? (
										<div className="rounded-lg border border-sky-100 bg-sky-50/70 p-3">
											<h5 className="text-xs font-bold uppercase tracking-wide text-sky-700">AI 분석</h5>
											<p className="mt-1.5 text-sm leading-relaxed text-sky-900">{issue.aiExplanation}</p>
										</div>
									) : null}
								</div>

								<div className="border-t border-slate-100 px-5 py-4">
									<h5 className="text-xs font-bold uppercase tracking-wide text-slate-500">단계별 해결 방법</h5>
									{guide.steps?.length ? (
										<ol className="mt-3 space-y-3">
											{guide.steps.map((step, stepIdx) => (
												<li key={stepIdx} className="flex gap-3">
													<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
														{stepIdx + 1}
													</span>
													<div>
														<p className="text-sm font-bold text-slate-900">{step.title}</p>
														<p className="mt-0.5 text-sm leading-relaxed text-slate-600">{step.detail}</p>
													</div>
												</li>
											))}
										</ol>
									) : issue.suggestedFix ? (
										<p className="mt-2 text-sm text-slate-600">{issue.suggestedFix}</p>
									) : (
										<p className="mt-2 text-sm text-slate-500">상세 단계가 없습니다.</p>
									)}
								</div>

								<div className="border-t border-slate-100 px-5 py-4">
									<h5 className="text-xs font-bold uppercase tracking-wide text-slate-500">적용 후 확인</h5>
									{guide.verify?.length ? (
										<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
											{guide.verify.map((item, verifyIdx) => (
												<li key={verifyIdx}>{item}</li>
											))}
										</ul>
									) : (
										<p className="mt-2 text-sm text-slate-500">재진단으로 반영 여부를 확인하세요.</p>
									)}
								</div>

								<div className="border-t border-slate-100 px-5 py-4">
									{hasCode ? (
										<>
											<h5 className="text-xs font-bold uppercase tracking-wide text-slate-500">
												CMS 코드 — {tabMeta.label}
											</h5>
											<p className="mt-1 text-sm text-slate-600">{getCmsHowTo(activeCms, true)}</p>
											{cmsKeys.length > 1 ? (
												<div className="mt-3 flex flex-wrap gap-1.5">
													{cmsKeys.map((cmsKey) => (
														<button
															key={cmsKey}
															type="button"
															onClick={() => setActiveCmsByIssue((prev) => ({ ...prev, [idx]: cmsKey }))}
															className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase transition ${
																cmsKey === activeCms
																	? 'bg-slate-900 text-white'
																	: 'bg-slate-100 text-slate-600 hover:bg-slate-200'
															}`}
														>
															{CMS_TAB_META[cmsKey]?.label || cmsKey}
														</button>
													))}
												</div>
											) : null}
											<div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
												<div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
													<span className="truncate font-mono text-[11px] font-semibold text-slate-600">
														{CMS_TAB_META[activeCms]?.file || tabMeta.file}
													</span>
													<button
														type="button"
														onClick={async () => {
															const ok = await copyText(codeContent);
															if (ok) {
																setCopiedId(copyKey);
																window.setTimeout(() => setCopiedId(null), 1500);
															}
														}}
														className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
													>
														{copiedId === copyKey ? '복사됨' : '코드 복사'}
													</button>
												</div>
												<pre className="max-h-56 overflow-auto p-3 text-[12px] leading-relaxed text-slate-800">
													<code>{codeContent}</code>
												</pre>
											</div>
										</>
									) : (
										<>
											<h5 className="text-xs font-bold uppercase tracking-wide text-slate-500">코드 삽입</h5>
											<p className="mt-1 text-sm text-slate-600">
												{guide.cms?.note || getCmsHowTo(prefKey, false)}
											</p>
										</>
									)}
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
