import { creditRatio, type AdminMember } from '@/lib/admin/user-management';

export function UserCreditBar({ member }: { member: AdminMember }) {
	const ratio = creditRatio(member);
	const low = ratio <= 20;

	return (
		<div className="min-w-[132px]">
			<div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
				<span className={`font-bold tabular-nums ${low ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100'}`}>
					{member.credits_remaining}
					<span className="font-medium text-slate-400 dark:text-slate-500"> / {member.credits_total}</span>
				</span>
				<span className="text-slate-400 dark:text-slate-500">{ratio}%</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60" aria-hidden>
				<div
					className={`h-full rounded-full transition-[width] ${low ? 'bg-rose-500' : 'bg-violet-500'}`}
					style={{ width: `${ratio}%` }}
				/>
			</div>
		</div>
	);
}
