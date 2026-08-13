'use client';

import { useState } from 'react';

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

const EMPTY: FormState = {
	name: '',
	company: '',
	email: '',
	phone: '',
	inquiryType: '',
	message: '',
	pageUrl: '',
};

const inputClass =
	'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none';

export function ContactInquiryForm() {
	const [form, setForm] = useState<FormState>(EMPTY);
	const [submitting, setSubmitting] = useState(false);
	const [done, setDone] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function update<K extends keyof FormState>(key: K, value: FormState[K]) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		setError(null);
		try {
			const res = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(form),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? '문의 접수에 실패했습니다.');
			setDone(true);
			setForm(EMPTY);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setSubmitting(false);
		}
	}

	if (done) {
		return (
			<div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-6 text-center">
				<p className="text-sm font-bold text-emerald-300">작업 문의가 접수되었습니다.</p>
				<p className="mt-2 text-xs text-slate-400">담당자가 1영업일 이내에 연락드립니다.</p>
				<button
					type="button"
					onClick={() => setDone(false)}
					className="mt-4 text-xs font-semibold text-slate-400 hover:text-white"
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
			className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6"
		>
			<div className="flex items-center gap-2">
				<span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-light">
					Work Inquiry
				</span>
			</div>
			<h2 className="text-lg font-bold text-white">작업 문의 접수</h2>
			<p className="text-xs text-slate-400">
				GEO·SEO·스키마 개선 등 실제 작업이 필요하시면 아래 양식으로 접수해 주세요.
			</p>

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
				<Field label="문의 유형" required>
					<select
						required
						value={form.inquiryType}
						onChange={(e) => update('inquiryType', e.target.value as InquiryType | '')}
						className={inputClass}
					>
						<option value="" disabled>
							선택해 주세요
						</option>
						{INQUIRY_TYPES.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
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

			{error && <p className="text-sm text-rose-400">{error}</p>}

			<button
				type="submit"
				disabled={submitting}
				className="rounded-lg bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-light disabled:opacity-50"
			>
				{submitting ? '접수 중...' : '문의 접수하기'}
			</button>
		</form>
	);
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
				{label}
				{required && <span className="ml-1 text-accent-light">*</span>}
			</span>
			{children}
		</label>
	);
}
