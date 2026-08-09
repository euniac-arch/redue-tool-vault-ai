'use client';

import { useState } from 'react';

const SITE_COUNT_OPTIONS = [
	{ value: '50+', label: '50개 이상' },
	{ value: '100+', label: '100개 이상' },
] as const;

type SiteCount = (typeof SITE_COUNT_OPTIONS)[number]['value'];

interface FormState {
	companyName: string;
	contactName: string;
	title: string;
	email: string;
	phone: string;
	siteCount: SiteCount | '';
}

const EMPTY: FormState = {
	companyName: '',
	contactName: '',
	title: '',
	email: '',
	phone: '',
	siteCount: '',
};

export function EnterpriseInquiryForm() {
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
			const res = await fetch('/api/enterprise/inquiry', {
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
				<p className="text-sm font-bold text-emerald-300">엔터프라이즈 도입 상담이 접수되었습니다.</p>
				<p className="mt-2 text-xs text-slate-400">전담 매니저가 1영업일 이내에 연락드립니다.</p>
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
		<form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
			<div className="flex items-center gap-2">
				<span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
					Enterprise
				</span>
				<span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
					On-Premise
				</span>
			</div>
			<h2 className="text-lg font-bold text-white">엔터프라이즈 도입 상담 신청</h2>
			<p className="text-xs text-slate-400">보안·대규모 사이트 운영이 필요한 기업 고객을 위한 맞춤 도입 문의입니다.</p>

			<div className="grid gap-3 sm:grid-cols-2">
				<Field label="기업명" required>
					<input
						required
						value={form.companyName}
						onChange={(e) => update('companyName', e.target.value)}
						className={inputClass}
						placeholder="주식회사 REDUE"
					/>
				</Field>
				<Field label="담당자 이름" required>
					<input
						required
						value={form.contactName}
						onChange={(e) => update('contactName', e.target.value)}
						className={inputClass}
						placeholder="홍길동"
					/>
				</Field>
				<Field label="직책">
					<input
						value={form.title}
						onChange={(e) => update('title', e.target.value)}
						className={inputClass}
						placeholder="CTO / 마케팅 팀장"
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
				<Field label="연락처" required>
					<input
						required
						value={form.phone}
						onChange={(e) => update('phone', e.target.value)}
						className={inputClass}
						placeholder="010-0000-0000"
					/>
				</Field>
				<Field label="관리 사이트 수" required>
					<select
						required
						value={form.siteCount}
						onChange={(e) => update('siteCount', e.target.value as SiteCount | '')}
						className={inputClass}
					>
						<option value="" disabled>
							선택해 주세요
						</option>
						{SITE_COUNT_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</Field>
			</div>

			{error && <p className="text-sm text-rose-400">{error}</p>}

			<button
				type="submit"
				disabled={submitting}
				className="rounded-lg bg-gradient-to-r from-amber-500/90 to-cyan-500/80 px-5 py-3 text-sm font-bold text-[#0C0D0E] transition hover:opacity-90 disabled:opacity-50"
			>
				{submitting ? '접수 중...' : '엔터프라이즈 도입 상담 신청'}
			</button>
		</form>
	);
}

const inputClass =
	'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
				{label}
				{required && <span className="ml-1 text-amber-400">*</span>}
			</span>
			{children}
		</label>
	);
}
