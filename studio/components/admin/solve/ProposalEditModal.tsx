'use client';

import { useEffect, useState } from 'react';
import { formatKrw } from '@/lib/solve/estimate';

export interface ProposalEditValues {
	clientName: string;
	contactName: string;
	discountRatePct: number;
	finalQuoteKRW: number;
	focusKeywords: string;
	customMessage: string;
}

interface ProposalEditModalProps {
	open: boolean;
	onClose: () => void;
	defaultClientName: string;
	autoQuoteKRW: number;
	onSubmit: (values: ProposalEditValues) => void;
	onGeneratePdf: (values: ProposalEditValues) => void;
	onGeneratePptx: (values: ProposalEditValues) => void;
}

export function ProposalEditModal({
	open,
	onClose,
	defaultClientName,
	autoQuoteKRW,
	onSubmit,
	onGeneratePdf,
	onGeneratePptx,
}: ProposalEditModalProps) {
	const [values, setValues] = useState<ProposalEditValues>({
		clientName: defaultClientName,
		contactName: '',
		discountRatePct: 0,
		finalQuoteKRW: autoQuoteKRW,
		focusKeywords: '',
		customMessage: '',
	});

	useEffect(() => {
		if (!open) return;
		setValues((prev) => ({
			...prev,
			clientName: prev.clientName || defaultClientName,
			finalQuoteKRW: prev.finalQuoteKRW || autoQuoteKRW,
		}));
	}, [open, defaultClientName, autoQuoteKRW]);

	if (!open) return null;

	function update<K extends keyof ProposalEditValues>(key: K, value: ProposalEditValues[K]) {
		setValues((prev) => ({ ...prev, [key]: value }));
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
			<button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="닫기" onClick={onClose} />
			<div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
				<button
					type="button"
					onClick={onClose}
					className="absolute right-3 top-3 rounded-md px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label="닫기"
				>
					×
				</button>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Hybrid · Token Saver</p>
				<h2 className="mt-1 text-lg font-bold text-slate-900">제안서 내용 / 견적 직접 편집</h2>
				<p className="mt-1 text-sm text-slate-600">
					직접 입력한 문구·견적으로 렌더링만 수행합니다. Claude 대량 카피 생성을 건너뛰어 토큰을 절감합니다.
				</p>

				<form
					className="mt-4 flex flex-col gap-3"
					onSubmit={(e) => {
						e.preventDefault();
						onSubmit(values);
					}}
				>
					<label className="flex flex-col gap-1">
						<span className="text-xs font-bold text-slate-500">클라이언트 / 병원명</span>
						<input
							required
							value={values.clientName}
							onChange={(e) => update('clientName', e.target.value)}
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
						/>
					</label>
					<label className="flex flex-col gap-1">
						<span className="text-xs font-bold text-slate-500">담당자 / 원장님 성함</span>
						<input
							value={values.contactName}
							onChange={(e) => update('contactName', e.target.value)}
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
						/>
					</label>
					<div className="grid grid-cols-2 gap-3">
						<label className="flex flex-col gap-1">
							<span className="text-xs font-bold text-slate-500">특별 할인율 (%)</span>
							<input
								type="number"
								min={0}
								max={90}
								value={values.discountRatePct}
								onChange={(e) => update('discountRatePct', Number(e.target.value) || 0)}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className="text-xs font-bold text-slate-500">최종 적용 견적 (₩)</span>
							<input
								type="number"
								min={0}
								step={10000}
								value={values.finalQuoteKRW}
								onChange={(e) => update('finalQuoteKRW', Number(e.target.value) || 0)}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
							/>
							<span className="text-[11px] text-slate-500">자동 계산: {formatKrw(autoQuoteKRW)}</span>
						</label>
					</div>
					<label className="flex flex-col gap-1">
						<span className="text-xs font-bold text-slate-500">강조할 핵심 키워드</span>
						<input
							value={values.focusKeywords}
							onChange={(e) => update('focusKeywords', e.target.value)}
							placeholder="예: 임플란트, 교정"
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
						/>
					</label>
					<label className="flex flex-col gap-1">
						<span className="text-xs font-bold text-slate-500">추가 전달 메시지</span>
						<textarea
							rows={3}
							value={values.customMessage}
							onChange={(e) => update('customMessage', e.target.value)}
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
						/>
					</label>

					<div className="mt-2 flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => onGeneratePptx(values)}
							className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
						>
							수정 내용으로 PPTX 생성
						</button>
						<button
							type="button"
							onClick={() => onGeneratePdf(values)}
							className="rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
						>
							수정된 내용으로 제안서 (.pdf)
						</button>
						<button
							type="submit"
							className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
						>
							편집 내용만 저장
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
