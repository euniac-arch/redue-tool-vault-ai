import type { DiagnosisUserType } from '@/lib/projects';

const STYLES: Record<DiagnosisUserType, string> = {
	admin: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
	user: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
	guest: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-700',
};

const LABELS: Record<DiagnosisUserType, string> = {
	admin: '관리자',
	user: '회원',
	guest: '비회원',
};

/** Diagnosing-party badge: admin (purple) / user (green) / guest (gray). */
export function UserTypeBadge({ userType, className = '' }: { userType: DiagnosisUserType; className?: string }) {
	return (
		<span
			className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${STYLES[userType]} ${className}`}
		>
			{LABELS[userType]}
		</span>
	);
}
