'use client';

import { useMemo, useState } from 'react';
import { calculateClientEstimate, formatKrw } from '@/lib/solve/estimate';
import { CMS_DISPLAY_OPTIONS, type SolveAuditSnapshot } from '@/lib/solve/types';
import { ProposalEditModal, type ProposalEditValues } from './ProposalEditModal';

interface ProposalTabProps {
	audit: SolveAuditSnapshot;
}

export function ProposalTab({ audit }: ProposalTabProps) {
	const [clientName, setClientName] = useState(() => hostnameFromUrl(audit.targetUrl));
	const [agencyName, setAgencyName] = useState('REDUE AI Studio');
	const [cmsType, setCmsType] = useState(audit.cmsType || 'WordPress');
	const [hourlyRate, setHourlyRate] = useState(50000);
	const [editOpen, setEditOpen] = useState(false);
	const [editOverrides, setEditOverrides] = useState<ProposalEditValues | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);

	const estimate = useMemo(
		() => calculateClientEstimate(audit.issues, hourlyRate),
		[audit.issues, hourlyRate],
	);

	const displayQuote =
		editOverrides?.finalQuoteKRW != null && editOverrides.finalQuoteKRW > 0
			? editOverrides.finalQuoteKRW
			: estimate.totalEstimateKRW;

	const displayClient = editOverrides?.clientName?.trim() || clientName;

	async function runAction(key: string, label: string) {
		setBusy(key);
		setStatusMessage(null);
		await wait(600);
		setBusy(null);
		setStatusMessage(
			`${label} UI가 준비되었습니다. 서버 PDF/PPTX/Excel 엔진 연동 시 이 버튼에서 다운로드됩니다. (견적 ${formatKrw(displayQuote)} · ${displayClient})`,
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
				<button
					type="button"
					disabled={!!busy}
					onClick={() => void runAction('roi-pdf', 'ROI PDF 제안서')}
					className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
				>
					{busy === 'roi-pdf' ? '생성 중…' : '개선 기대효과 및 ROI 제안서 (.pdf)'}
				</button>
				<button
					type="button"
					disabled={!!busy}
					onClick={() => void runAction('roi-pptx', '영업용 PPTX')}
					className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
				>
					{busy === 'roi-pptx' ? '생성 중…' : '영업용 제안서 (.pptx)'}
				</button>
				<button
					type="button"
					onClick={() => setEditOpen(true)}
					className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
				>
					제안서 내용/견적 직접 편집
				</button>
			</div>

			{statusMessage ? (
				<div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status">
					{statusMessage}
				</div>
			) : null}

			<div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
				<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
					<div className="mb-4">
						<h3 className="text-base font-bold text-slate-900">제안서 &amp; 견적 출력</h3>
						<p className="mt-1 text-sm text-slate-600">
							에이전시 납품용 SEO/GEO 통합 PDF와 Excel 체크리스트 폼입니다. 상단에서 ROI 제안서도 별도 생성할 수 있습니다.
						</p>
					</div>
					<form
						className="flex flex-col gap-3"
						onSubmit={(e) => {
							e.preventDefault();
							void runAction('report', 'PDF + Excel');
						}}
					>
						<label className="flex flex-col gap-1">
							<span className="text-xs font-bold text-slate-500">고객사명</span>
							<input
								value={clientName}
								onChange={(e) => setClientName(e.target.value)}
								placeholder="예: 삼삼물산 (주)"
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className="text-xs font-bold text-slate-500">에이전시명</span>
							<input
								value={agencyName}
								onChange={(e) => setAgencyName(e.target.value)}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
							/>
						</label>
						<div className="grid gap-3 sm:grid-cols-2">
							<label className="flex flex-col gap-1">
								<span className="text-xs font-bold text-slate-500">CMS / 플랫폼</span>
								<select
									value={cmsType}
									onChange={(e) => setCmsType(e.target.value)}
									className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
								>
									{CMS_DISPLAY_OPTIONS.map((cms) => (
										<option key={cms} value={cms}>
											{cms}
										</option>
									))}
									<option value="UNKNOWN">자동 감지</option>
								</select>
							</label>
							<label className="flex flex-col gap-1">
								<span className="text-xs font-bold text-slate-500">시간당 단가 (₩)</span>
								<input
									type="number"
									min={0}
									step={1000}
									value={hourlyRate}
									onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
									className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
								/>
							</label>
						</div>
						<button
							type="submit"
							disabled={!!busy}
							className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
						>
							{busy === 'report' ? '생성 중…' : 'PDF + Excel 생성'}
						</button>
					</form>
				</section>

				<aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
					<h4 className="text-sm font-bold text-slate-900">견적 미리보기</h4>
					<div className="mt-3 grid grid-cols-2 gap-2">
						{[
							{ label: '종합 점수', value: String(audit.overallScore ?? '—') },
							{ label: '조치 항목', value: `${estimate.issueCount}건` },
							{ label: '예상 공수', value: `${estimate.estimatedHours}h` },
							{ label: '견적 금액', value: formatKrw(displayQuote), highlight: true },
						].map((stat) => (
							<div
								key={stat.label}
								className={`rounded-lg border px-3 py-2.5 ${
									stat.highlight
										? 'border-slate-900 bg-slate-900 text-white'
										: 'border-slate-100 bg-slate-50 text-slate-900'
								}`}
							>
								<p className="text-lg font-extrabold tabular-nums">{stat.value}</p>
								<p className={`text-[11px] font-medium ${stat.highlight ? 'text-slate-300' : 'text-slate-500'}`}>
									{stat.label}
								</p>
							</div>
						))}
					</div>
					<ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-slate-600">
						<li>표지 · 핵심 요약 · 영역별 점검표</li>
						<li>통합 개선 로드맵 (3단계)</li>
						<li>Excel 이슈 체크리스트 + CMS 스니펫</li>
						<li>ROI PDF · 영업용 PPTX (기대효과·유입·견적)</li>
					</ul>
					{editOverrides ? (
						<p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
							직접 편집 적용됨 · 고객: {displayClient}
							{editOverrides.discountRatePct
								? ` · 할인 ${editOverrides.discountRatePct}%`
								: ''}
						</p>
					) : null}
				</aside>
			</div>

			<ProposalEditModal
				open={editOpen}
				onClose={() => setEditOpen(false)}
				defaultClientName={clientName}
				autoQuoteKRW={estimate.totalEstimateKRW}
				onSubmit={(values) => {
					setEditOverrides(values);
					if (values.clientName.trim()) setClientName(values.clientName.trim());
					setEditOpen(false);
					setStatusMessage(`견적 편집이 반영되었습니다. (${formatKrw(values.finalQuoteKRW || estimate.totalEstimateKRW)})`);
				}}
				onGeneratePdf={(values) => {
					setEditOverrides(values);
					setEditOpen(false);
					void runAction('edit-pdf', '편집본 PDF');
				}}
				onGeneratePptx={(values) => {
					setEditOverrides(values);
					setEditOpen(false);
					void runAction('edit-pptx', '편집본 PPTX');
				}}
			/>
		</div>
	);
}

function hostnameFromUrl(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return '고객사';
	}
}

function wait(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}
