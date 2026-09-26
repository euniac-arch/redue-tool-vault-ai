'use client';

import { useRef, useState } from 'react';
import { CustomSelect } from '@/components/ui/CustomSelect';

const INQUIRY_TYPES = [
	{ value: 'geo', label: 'GEO 최적화 작업' },
	{ value: 'seo', label: 'SEO 개선 작업' },
	{ value: 'schema', label: '스키마 / 구조화 데이터' },
	{ value: 'audit', label: '정밀 진단 컨설팅' },
	{ value: 'general', label: '기타 문의' },
] as const;

type InquiryType = (typeof INQUIRY_TYPES)[number]['value'];

interface FormState {
	name: string;
	company: string;
	email: string;
	phone: string;
	inquiryType: InquiryType | '';
	message: string;
	pageUrl: string;
}

export interface ContactInquiryFormProps {
	defaults?: Partial<FormState>;
	variant?: 'page' | 'embedded';
	onSubmitted?: () => void;
}

const EMPTY: FormState = {
	name: '',
	company: '',
	email: '',
	phone: '',
	inquiryType: '',
	message: '',
	pageUrl: '',
};

const PRIVACY_ERROR = '개인정보 수집 및 이용에 동의해 주세요.';

const inputClass =
	'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-slate-800 dark:bg-slate-950/90 dark:text-white dark:placeholder-slate-500';

export function ContactInquiryForm({ defaults, variant = 'page', onSubmitted }: ContactInquiryFormProps = {}) {
	const [form, setForm] = useState<FormState>({ ...EMPTY, ...defaults });
	const [submitting, setSubmitting] = useState(false);
	const [done, setDone] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPrivacyAgreed, setIsPrivacyAgreed] = useState(false);
	const [isPrivacyTermsOpen, setIsPrivacyTermsOpen] = useState(true);
	const privacyCheckboxRef = useRef<HTMLInputElement>(null);

	function update<K extends keyof FormState>(key: K, value: FormState[K]) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	function handlePrivacyChange(checked: boolean) {
		setIsPrivacyAgreed(checked);
		if (checked) {
			setError((prev) => (prev === PRIVACY_ERROR ? null : prev));
		}
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!isPrivacyAgreed) {
			setError(PRIVACY_ERROR);
			privacyCheckboxRef.current?.focus();
			privacyCheckboxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			const res = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				cache: 'no-store',
				body: JSON.stringify(form),
			});
			const data = (await res.json().catch(() => ({}))) as { error?: string };
			if (!res.ok) {
				console.error('[contact-form] submit failed', { status: res.status, error: data.error ?? null });
				throw new Error(data.error ?? '문의 접수에 실패했습니다.');
			}
			setDone(true);
			setForm({ ...EMPTY, ...defaults });
			setIsPrivacyAgreed(false);
			setIsPrivacyTermsOpen(true);
			onSubmitted?.();
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setSubmitting(false);
		}
	}

	if (done) {
		return (
			<div className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0B1120]/80 dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] sm:p-10">
				<p className="text-sm font-bold text-cyan-700 dark:text-cyan-400">작업 문의가 접수되었습니다.</p>
				<p className="mt-2 text-xs text-slate-600 dark:text-slate-300/80">담당자가 1영업일 이내에 연락드립니다.</p>
				<button
					type="button"
					onClick={() => setDone(false)}
					className="mt-4 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
				>
					추가 문의하기
				</button>
			</div>
		);
	}

	return (
		<form
			id="contact-form"
			onSubmit={handleSubmit}
			className={
				variant === 'embedded'
					? 'flex flex-col gap-4'
					: 'flex w-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0B1120]/80 dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] sm:p-10'
			}
		>
			{variant === 'page' ? (
				<>
					<div className="flex items-center gap-2">
						<span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:border-slate-800 dark:bg-slate-900 dark:text-cyan-400">
							Work Inquiry
						</span>
					</div>
					<h2 className="text-lg font-bold text-slate-900 dark:text-white">작업 문의 접수</h2>
					<p className="text-xs text-slate-600 dark:text-slate-300/80">
						GEO·SEO·스키마 개선 등 실제 작업이 필요하시면 아래 양식으로 접수해 주세요.
					</p>
				</>
			) : null}

			<div className="grid gap-3 sm:grid-cols-2">
				<Field label="담당자명" required>
					<input
						required
						value={form.name}
						onChange={(e) => update('name', e.target.value)}
						className={inputClass}
						placeholder="홍길동"
					/>
				</Field>
				<Field label="회사명">
					<input
						value={form.company}
						onChange={(e) => update('company', e.target.value)}
						className={inputClass}
						placeholder="주식회사 REDUE"
					/>
				</Field>
				<Field label="이메일" required>
					<input
						required
						type="email"
						value={form.email}
						onChange={(e) => update('email', e.target.value)}
						className={inputClass}
						placeholder="you@company.com"
					/>
				</Field>
				<Field label="연락처">
					<input
						value={form.phone}
						onChange={(e) => update('phone', e.target.value)}
						className={inputClass}
						placeholder="010-0000-0000"
					/>
				</Field>
				<Field label="문의 유형" required htmlFor="contact-inquiry-type">
					<CustomSelect
						id="contact-inquiry-type"
						required
						value={form.inquiryType}
						onChange={(e) => update('inquiryType', e.target.value as InquiryType | '')}
						className="h-[2.75rem] border-slate-200 !bg-white text-sm text-slate-900 dark:border-slate-800 dark:!bg-slate-950/90 dark:text-white"
						aria-label="문의 유형"
					>
						<option value="" disabled>
							선택해 주세요
						</option>
						{INQUIRY_TYPES.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</CustomSelect>
				</Field>
				<Field label="대상 URL">
					<input
						type="url"
						value={form.pageUrl}
						onChange={(e) => update('pageUrl', e.target.value)}
						className={inputClass}
						placeholder="https://your-company.com"
					/>
				</Field>
			</div>

			<Field label="문의 내용" required>
				<textarea
					required
					rows={5}
					value={form.message}
					onChange={(e) => update('message', e.target.value)}
					className={`${inputClass} resize-y`}
					placeholder="원하시는 작업 범위, 일정, 참고할 진단 결과 등을 적어 주세요."
				/>
			</Field>

			<div>
				<div className="flex items-start gap-2.5 sm:gap-3">
					<input
						ref={privacyCheckboxRef}
						id="contact-privacy-agree"
						type="checkbox"
						checked={isPrivacyAgreed}
						onChange={(e) => handlePrivacyChange(e.target.checked)}
						aria-required="true"
						aria-invalid={error === PRIVACY_ERROR}
						aria-describedby={
							[
								isPrivacyTermsOpen ? 'contact-privacy-terms' : null,
								error === PRIVACY_ERROR ? 'contact-privacy-error' : null,
							]
								.filter(Boolean)
								.join(' ') || undefined
						}
						className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-400 accent-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 dark:border-slate-600"
					/>
					<div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
						<label
							htmlFor="contact-privacy-agree"
							className="cursor-pointer text-xs font-medium leading-5 text-slate-600 dark:text-slate-300"
						>
							<span className="text-cyan-600 dark:text-cyan-400">[필수]</span> 개인정보 수집 및 이용에
							동의합니다.
						</label>
						<button
							type="button"
							onClick={() => setIsPrivacyTermsOpen((open) => !open)}
							className="shrink-0 self-start text-[11px] font-medium text-slate-500 underline-offset-2 transition hover:text-cyan-600 hover:underline dark:text-slate-400 dark:hover:text-cyan-400"
							aria-expanded={isPrivacyTermsOpen}
							aria-controls="contact-privacy-terms"
						>
							{isPrivacyTermsOpen ? '약관 닫기' : '약관 보기'}
						</button>
					</div>
				</div>

				{isPrivacyTermsOpen ? (
					<div
						id="contact-privacy-terms"
						className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400"
					>
						<dl className="space-y-1.5">
							<div>
								<dt className="font-medium text-slate-600 dark:text-slate-300">수집 항목</dt>
								<dd>성함/담당자명, 연락처, 이메일, 웹사이트 URL, 문의 내용</dd>
							</div>
							<div>
								<dt className="font-medium text-slate-600 dark:text-slate-300">수집 및 이용 목적</dt>
								<dd>문의 사항 확인 및 상담 안내, 견적 산출 및 분석 결과 회신</dd>
							</div>
							<div>
								<dt className="font-medium text-slate-600 dark:text-slate-300">보유 및 이용 기간</dt>
								<dd>문의 접수일로부터 상담 완료 후 3개월 (또는 법령에 따른 보존 기간)</dd>
							</div>
						</dl>
						<p className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
							귀하는 개인정보 수집 동의를 거부할 권리가 있으며, 거부 시 온라인 문의 접수가 제한될 수 있습니다.
						</p>
					</div>
				) : null}
			</div>

			{error && (
				<p
					id={error === PRIVACY_ERROR ? 'contact-privacy-error' : undefined}
					className="text-sm text-rose-600 dark:text-rose-400"
					role="alert"
				>
					{error}
				</p>
			)}

			<button
				type="submit"
				disabled={submitting}
				className={`w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-4 text-sm font-bold text-white shadow-lg shadow-cyan-900/40 transition-all hover:scale-[1.01] hover:from-cyan-400 hover:to-blue-500 active:scale-[0.99] disabled:opacity-50 sm:text-base ${
					!isPrivacyAgreed && !submitting ? 'opacity-70' : ''
				}`}
			>
				{submitting ? '접수 중...' : '문의 접수하기'}
			</button>
		</form>
	);
}

function Field({
	label,
	required,
	htmlFor,
	children,
}: {
	label: string;
	required?: boolean;
	htmlFor?: string;
	children: React.ReactNode;
}) {
	const labelClass = 'mb-2 block text-xs font-semibold text-slate-600 sm:text-sm dark:text-slate-300';
	const title = (
		<>
			{label}
			{required && <span className="ml-1 text-cyan-400">*</span>}
		</>
	);

	if (htmlFor) {
		return (
			<div>
				<label htmlFor={htmlFor} className={labelClass}>
					{title}
				</label>
				{children}
			</div>
		);
	}

	return (
		<label className="block">
			<span className={labelClass}>{title}</span>
			{children}
		</label>
	);
}
