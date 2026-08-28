'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Ban, Globe, Mail, Minus, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import {
	formatDateTime,
	type AdminMember,
} from '@/lib/admin/user-management';
import { UserAvatar } from './UserAvatar';
import { UserPlanBadge, UserProviderBadge, UserRoleBadge, UserScoreBadge, UserStatusBadge } from './user-badges';

const CREDIT_GRANTS = [10, 50, 100] as const;
const CREDIT_RECLAIMS = [10, 50] as const;
const MEMO_DEBOUNCE_MS = 600;

interface UserDetailModalProps {
	member: AdminMember;
	onClose: () => void;
	onMemoChange: (id: string, memo: string) => void;
	onCreditDelta: (id: string, delta: number) => void;
	onToggleStatus: (id: string) => void;
	onDelete?: (id: string) => void;
}

export function UserDetailModal({
	member,
	onClose,
	onMemoChange,
	onCreditDelta,
	onToggleStatus,
	onDelete,
}: UserDetailModalProps) {
	const [memo, setMemo] = useState(member.memo);
	const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
	const savedMemoRef = useRef(member.memo);

	useEffect(() => {
		setMemo(member.memo);
		savedMemoRef.current = member.memo;
		setSaveState('idle');
	}, [member.id]);

	useEffect(() => {
		if (memo === savedMemoRef.current) return;
		setSaveState('dirty');
		const timer = window.setTimeout(() => {
			setSaveState('saving');
			onMemoChange(member.id, memo);
			savedMemoRef.current = memo;
			setSaveState('saved');
		}, MEMO_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [memo, member.id, onMemoChange]);

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	function saveNow() {
		onMemoChange(member.id, memo);
		savedMemoRef.current = memo;
		setSaveState('saved');
	}

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
				aria-labelledby="user-detail-title"
				className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-800 dark:border-slate-700"
			>
				<header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
					<div className="flex min-w-0 items-start gap-3">
						<UserAvatar src={member.profileImage} name={member.name} size={44} />
						<div className="min-w-0">
							<p className="font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">{member.id}</p>
							<h2 id="user-detail-title" className="mt-0.5 truncate text-lg font-bold text-slate-900 dark:text-slate-100">
								{member.name}
							</h2>
							<div className="mt-2 flex flex-wrap items-center gap-2">
								<UserProviderBadge provider={member.provider} />
								<UserRoleBadge role={member.role} />
								<UserPlanBadge plan={member.plan} />
								<UserStatusBadge status={member.status} />
							</div>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
						aria-label="닫기"
					>
						<X className="h-4 w-4" />
					</button>
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
					<section className="grid gap-3 sm:grid-cols-2">
						<InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="계정" value={member.email} />
						<InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="등록 도메인" value={`${member.domains_count}개 · ${member.recent_domain}`} />
						<InfoRow label="가입일시" value={formatDateTime(member.created_at)} />
						<InfoRow label="최근 로그인" value={formatDateTime(member.last_login_at)} />
						<InfoRow label="가입 IP" value={member.signup_ip} mono />
						<InfoRow label="최근 접속 IP" value={member.last_login_ip} mono />
					</section>

					<section className="mt-6">
						<div className="mb-2 flex items-center justify-between gap-2">
							<h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">최근 진단 이력</h3>
							<span className="text-[11px] text-slate-400 dark:text-slate-500">{member.audit_history.length}건</span>
						</div>
						{member.audit_history.length === 0 ? (
							<p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-slate-700/60 dark:text-slate-400 dark:border-slate-700">
								진단 이력이 없습니다.
							</p>
						) : (
							<div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
								<table className="w-full min-w-[560px] text-left text-sm">
									<thead>
										<tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-700/60 dark:text-slate-400 dark:border-slate-700">
											<th className="px-3 py-2 font-semibold">도메인</th>
											<th className="px-3 py-2 font-semibold">진단일</th>
											<th className="px-3 py-2 font-semibold">종합</th>
											<th className="px-3 py-2 font-semibold">Track 1 기술</th>
											<th className="px-3 py-2 font-semibold">Track 2 GEO</th>
										</tr>
									</thead>
									<tbody>
										{member.audit_history.map((row) => (
											<tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
												<td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">{row.domain}</td>
												<td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(row.auditedAt)}</td>
												<td className="px-3 py-2">
													<UserScoreBadge score={row.overallScore} />
												</td>
												<td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">{row.track1TechScore}</td>
												<td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">{row.track2GeoScore}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>

					<section className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:bg-slate-700/60 dark:border-slate-700">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">크레딧 수동 지급 / 회수</h3>
							<p className="font-mono text-xs text-slate-500 dark:text-slate-400">
								잔여 {member.credits_remaining} / {member.credits_total}
							</p>
						</div>
						<div className="mt-3 flex flex-wrap gap-2">
							{CREDIT_GRANTS.map((amount) => (
								<button
									key={`plus-${amount}`}
									type="button"
									onClick={() => onCreditDelta(member.id, amount)}
									className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
								>
									<Plus className="h-3.5 w-3.5" />
									{amount}
								</button>
							))}
							{CREDIT_RECLAIMS.map((amount) => (
								<button
									key={`minus-${amount}`}
									type="button"
									onClick={() => onCreditDelta(member.id, -amount)}
									className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
								>
									<Minus className="h-3.5 w-3.5" />
									{amount}
								</button>
							))}
						</div>
					</section>

					<section className="mt-6">
						<div className="mb-2 flex items-center justify-between gap-2">
							<h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">관리자 메모</h3>
							<span className="text-[11px] text-slate-400 dark:text-slate-500">
								{saveState === 'dirty' && '수정됨'}
								{saveState === 'saving' && '저장 중…'}
								{saveState === 'saved' && '자동 저장됨'}
							</span>
						</div>
						<textarea
							value={memo}
							onChange={(event) => setMemo(event.target.value)}
							rows={4}
							className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-900/10 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
							placeholder="운영 메모를 입력하세요. 입력을 멈추면 자동 저장됩니다."
						/>
						<div className="mt-2 flex items-center justify-between gap-2">
							<p className="text-[11px] text-slate-400 dark:text-slate-500">Debounce {MEMO_DEBOUNCE_MS}ms 자동저장</p>
							<button
								type="button"
								onClick={saveNow}
								className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
							>
								<Save className="h-3.5 w-3.5" />
								저장
							</button>
						</div>
					</section>
				</div>

				<footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
					<div className="flex items-center gap-2">
						{member.status !== 'withdrawn' && (
							<button
								type="button"
								onClick={() => onToggleStatus(member.id)}
								className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
									member.status === 'active'
										? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
										: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
								}`}
							>
								{member.status === 'active' ? (
									<>
										<Ban className="h-3.5 w-3.5" />
										계정 정지
									</>
								) : (
									<>
										<ShieldCheck className="h-3.5 w-3.5" />
										정지 해제
									</>
								)}
							</button>
						)}
						{onDelete && (
							<button
								type="button"
								onClick={() => onDelete(member.id)}
								className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:bg-slate-800 dark:border-slate-700"
							>
								<Trash2 className="h-3.5 w-3.5" />
								회원 삭제
							</button>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
					>
						닫기
					</button>
				</footer>
			</div>
		</div>
	);
}

function InfoRow({
	label,
	value,
	mono,
	icon,
}: {
	label: string;
	value: string;
	mono?: boolean;
	icon?: ReactNode;
}) {
	return (
		<div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:bg-slate-800 dark:border-slate-700">
			<p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
				{icon}
				{label}
			</p>
			<p className={`mt-1 truncate text-sm text-slate-800 dark:text-slate-100 ${mono ? 'font-mono text-xs' : 'font-medium'}`}>{value}</p>
		</div>
	);
}
