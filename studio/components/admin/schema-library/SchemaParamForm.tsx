'use client';

import { useState, type KeyboardEvent } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import {
	SCHEMA_BUSINESS_TYPES,
	createSameAsItem,
	type SchemaTemplateParams,
} from '@/lib/schema/schemaTemplateService';

const FIELD =
	'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400';

const LABEL = 'mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300';

interface SchemaParamFormProps {
	value: SchemaTemplateParams;
	onChange: (next: SchemaTemplateParams) => void;
	onLoadSample: () => void;
}

export function SchemaParamForm({ value, onChange, onLoadSample }: SchemaParamFormProps) {
	const [tagDraft, setTagDraft] = useState('');

	function patch(partial: Partial<SchemaTemplateParams>) {
		onChange({ ...value, ...partial });
	}

	function addService(raw: string) {
		const name = raw.replace(/,/g, '').trim();
		if (!name) return;
		if (value.services.includes(name)) {
			setTagDraft('');
			return;
		}
		patch({ services: [...value.services, name] });
		setTagDraft('');
	}

	function onTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
			if (tagDraft.trim()) {
				event.preventDefault();
				addService(tagDraft);
			}
			return;
		}
		if (event.key === 'Backspace' && !tagDraft && value.services.length > 0) {
			patch({ services: value.services.slice(0, -1) });
		}
	}

	return (
		<section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">스키마 파라미터</h2>
					<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
						입력값이 바뀌면 우측 주입 코드가 즉시 다시 생성됩니다.
					</p>
				</div>
				<button
					type="button"
					onClick={onLoadSample}
					className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
				>
					<Sparkles className="h-3.5 w-3.5" aria-hidden />
					기본 샘플 데이터 불러오기
				</button>
			</div>

			<fieldset className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
				<legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
					기본 정보
				</legend>
				<div className="grid gap-3 sm:grid-cols-2">
					<label className="sm:col-span-2">
						<span className={LABEL}>상호 / 병원명</span>
						<input
							className={FIELD}
							value={value.businessName}
							onChange={(event) => patch({ businessName: event.target.value })}
							placeholder="서초피부과의원"
							autoComplete="organization"
						/>
					</label>
					<label>
						<span className={LABEL}>업종 타입</span>
						<select
							className={FIELD}
							value={value.businessType}
							onChange={(event) =>
								patch({ businessType: event.target.value as SchemaTemplateParams['businessType'] })
							}
						>
							{SCHEMA_BUSINESS_TYPES.map((type) => (
								<option key={type.value} value={type.value}>
									{type.label} — {type.hint}
								</option>
							))}
						</select>
					</label>
					<label>
						<span className={LABEL}>대표자명</span>
						<input
							className={FIELD}
							value={value.representativeName}
							onChange={(event) => patch({ representativeName: event.target.value })}
							placeholder="김민준"
							autoComplete="name"
						/>
					</label>
					<label className="sm:col-span-2">
						<span className={LABEL}>사이트 URL</span>
						<input
							className={FIELD}
							value={value.siteUrl}
							onChange={(event) => patch({ siteUrl: event.target.value })}
							placeholder="https://www.example.co.kr"
							inputMode="url"
							autoComplete="url"
						/>
					</label>
				</div>
			</fieldset>

			<fieldset className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
				<legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
					위치 / 연락처
				</legend>
				<div className="grid gap-3">
					<label>
						<span className={LABEL}>대표 전화번호</span>
						<input
							className={FIELD}
							value={value.telephone}
							onChange={(event) => patch({ telephone: event.target.value })}
							placeholder="02-555-1212"
							inputMode="tel"
							autoComplete="tel"
						/>
					</label>
					<label>
						<span className={LABEL}>도로명 주소</span>
						<input
							className={FIELD}
							value={value.streetAddress}
							onChange={(event) => patch({ streetAddress: event.target.value })}
							placeholder="서울특별시 서초구 강남대로 123, 5층"
							autoComplete="street-address"
						/>
					</label>
					<label>
						<span className={LABEL}>진료 / 영업 시간</span>
						<input
							className={FIELD}
							value={value.openingHours}
							onChange={(event) => patch({ openingHours: event.target.value })}
							placeholder="Mo-Fr 09:30-18:30, Sa 09:30-14:00"
						/>
					</label>
				</div>
			</fieldset>

			<fieldset className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
				<legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
					지식그래프 (sameAs)
				</legend>
				<div className="flex flex-col gap-2.5">
					{value.sameAs.map((item, index) => (
						<div key={item.id} className="grid gap-2 sm:grid-cols-[8.5rem_1fr_auto]">
							<input
								className={FIELD}
								value={item.label}
								onChange={(event) => {
									const sameAs = value.sameAs.map((row) =>
										row.id === item.id ? { ...row, label: event.target.value } : row,
									);
									patch({ sameAs });
								}}
								placeholder="채널명"
								aria-label={`채널 ${index + 1} 이름`}
							/>
							<input
								className={FIELD}
								value={item.url}
								onChange={(event) => {
									const sameAs = value.sameAs.map((row) =>
										row.id === item.id ? { ...row, url: event.target.value } : row,
									);
									patch({ sameAs });
								}}
								placeholder="https://"
								inputMode="url"
								aria-label={`${item.label || `채널 ${index + 1}`} URL`}
							/>
							<button
								type="button"
								onClick={() => patch({ sameAs: value.sameAs.filter((row) => row.id !== item.id) })}
								className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
								aria-label={`${item.label || '채널'} 삭제`}
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					))}
					<button
						type="button"
						onClick={() => patch({ sameAs: [...value.sameAs, createSameAsItem()] })}
						className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
					>
						<Plus className="h-3.5 w-3.5" aria-hidden />
						채널 추가
					</button>
				</div>
			</fieldset>

			<fieldset className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
				<legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
					핵심 키워드 / 서비스
				</legend>
				<div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900">
					{value.services.map((service) => (
						<span
							key={service}
							className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white dark:bg-white dark:text-slate-950"
						>
							{service}
							<button
								type="button"
								onClick={() => patch({ services: value.services.filter((item) => item !== service) })}
								className="rounded-full p-0.5 opacity-70 hover:opacity-100"
								aria-label={`${service} 삭제`}
							>
								<X className="h-3 w-3" />
							</button>
						</span>
					))}
					<input
						className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
						value={tagDraft}
						onChange={(event) => setTagDraft(event.target.value)}
						onKeyDown={onTagKeyDown}
						onBlur={() => addService(tagDraft)}
						placeholder="예) 덴서티 리프팅, Enter로 추가"
					/>
				</div>
			</fieldset>
		</section>
	);
}
