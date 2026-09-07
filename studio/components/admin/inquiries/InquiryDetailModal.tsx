'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ExternalLink, Mail, Phone, Trash2, X } from 'lucide-react';
import {
	INQUIRY_STATUS_OPTIONS,
	applicantLabel,
	displayOrDash,
	formatInquiryDateTime,
	formatInquiryNumber,
	inquiryTypeLabel,
	type ContactInquiry,
	type ContactInquiryStatus,
} from '@/lib/admin/inquiry-management';
import { InquiryStatusBadge, InquiryTypeBadge } from './inquiry-badges';

const SELECT_CLASS =
	'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-500';

interface InquiryDetailModalProps {
	inquiry: ContactInquiry;
	pending: boolean;
	onClose: () => void;
	onStatusChange: (id: string, status: ContactInquiryStatus) => void;
	onDelete: (id: string) => void;
}

export function InquiryDetailModal({
	inquiry,
	pending,
	onClose,
	onStatusChange,
	onDelete,
}: InquiryDetailModalProps) {
	const [confirmDelete, setConfirmDelete] = useState(false);

	useEffect(() => {
		setConfirmDelete(false);
	}, [inquiry.id]);

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				if (confirmDelete) {
					setConfirmDelete(false);
					return;
				}
				onClose();
			}
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [confirmDelete, onClose]);

	const websiteHref = safeExternalUrl(inquiry.pageUrl);

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
			<button
				type="button"
				className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
				aria-label="모달 닫기"
				onClick={onClose}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="inquiry-detail-title"
				className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl dark:border-slate-700 dark:bg-slate-800"
			>
				<header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
					<div className="min-w-0">
						<p className="font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">
							{formatInquiryNumber(inquiry.id)}
						</p>
						<h2 id="inquiry-detail-title" className="mt-0.5 truncate text-lg font-bold text-slate-900 dark:text-slate-100">
							{applicantLabel(inquiry)}
						</h2>
						<div className="mt-2 flex flex-wrap items-center gap-2">
							<InquiryStatusBadge status={inquiry.status} />
							<InquiryTypeBadge inquiryType={inquiry.inquiryType} serviceType={inquiry.serviceType} />
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
						aria-label="닫기"
					>
						<X className="h-4 w-4" />
					</button>
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
					<section className="grid gap-3 sm:grid-cols-2">
						<InfoRow label="성명" value={displayOrDash(inquiry.name)} />
						<InfoRow label="회사명" value={displayOrDash(inquiry.company)} />
						<InfoRow
							icon={<Phone className="h-3.5 w-3.5" />}
							label="연락처"
							value={inquiry.phone ? <a href={`tel:${inquiry.phone}`} className="hover:underline">{inquiry.phone}</a> : '—'}
						/>
						<InfoRow
							icon={<Mail className="h-3.5 w-3.5" />}
							label="이메일"
							value={
								inquiry.email ? (
									<a href={`mailto:${inquiry.email}`} className="hover:underline">
										{inquiry.email}
									</a>
								) : (
									'—'
								)
							}
						/>
						<InfoRow
							label="웹사이트 URL"
							className="sm:col-span-2"
							value={
								websiteHref ? (
									<a
										href={websiteHref}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 break-all text-cyan-700 hover:underline dark:text-cyan-300"
									>
										{inquiry.pageUrl}
										<ExternalLink className="h-3.5 w-3.5 shrink-0" />
									</a>
								) : (
									'—'
								)
							}
						/>
						<InfoRow label="문의 유형" value={inquiryTypeLabel(inquiry.inquiryType, inquiry.serviceType)} />
						<InfoRow label="접수일시" value={formatInquiryDateTime(inquiry.createdAt)} />
					</section>

					<section className="mt-6">
						<h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">문의 내용</h3>
						{inquiry.title ? (
							<p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{inquiry.title}</p>
						) : null}
						<textarea
							readOnly
							value={inquiry.message || '내용이 없습니다.'}
							rows={10}
							className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
						/>
					</section>

					<section className="mt-6">
						<label className="mb-2 block text-sm font-bold text-slate-800 dark:text-slate-100" htmlFor="inquiry-status">
							처리 상태
						</label>
						<select
							id="inquiry-status"
							className={SELECT_CLASS}
							value={inquiry.status}
							disabled={pending}
							onChange={(event) => onStatusChange(inquiry.id, event.target.value as ContactInquiryStatus)}
						>
							{INQUIRY_STATUS_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</section>
				</div>

				<footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
					<button
						type="button"
						disabled={pending}
						onClick={() => setConfirmDelete(true)}
						className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Trash2 className="h-3.5 w-3.5" />
						문의 삭제
					</button>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
					>
						닫기
					</button>
				</footer>

				{confirmDelete ? (
					<div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 px-4">
						<div
							role="alertdialog"
							aria-labelledby="inquiry-delete-title"
							aria-describedby="inquiry-delete-desc"
							className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
						>
							<h3 id="inquiry-delete-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
								이 문의를 삭제할까요?
							</h3>
							<p id="inquiry-delete-desc" className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
								스팸 또는 불필요한 접수 건은 삭제할 수 있습니다. 삭제 후 복구할 수 없습니다.
							</p>
							<div className="mt-4 flex justify-end gap-2">
								<button
									type="button"
									onClick={() => setConfirmDelete(false)}
									className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
								>
									취소
								</button>
								<button
									type="button"
									disabled={pending}
									onClick={() => onDelete(inquiry.id)}
									className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									삭제
								</button>
							</div>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

function InfoRow({
	label,
	value,
	icon,
	className = '',
}: {
	label: string;
	value: ReactNode;
	icon?: ReactNode;
	className?: string;
}) {
	return (
		<div className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/50 ${className}`}>
			<p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{label}</p>
			<p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
				{icon}
				<span className="min-w-0 break-all">{value}</span>
			</p>
		</div>
	);
}

function safeExternalUrl(value: string | null): string | null {
	const raw = value?.trim() || '';
	if (!raw) return null;
	try {
		const url = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return url.toString();
	} catch {
		return null;
	}
}
