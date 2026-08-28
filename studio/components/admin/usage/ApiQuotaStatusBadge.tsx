import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react';
import type { ApiQuotaStatus } from '@/lib/admin/api-quota';

const STATUS_STYLE: Record<ApiQuotaStatus, string> = {
	normal: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
	warning: 'bg-amber-50 text-amber-800 ring-amber-200',
	critical: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const STATUS_LABEL: Record<ApiQuotaStatus, string> = {
	normal: '정상',
	warning: '경고',
	critical: '위험',
};

const STATUS_ICON: Record<ApiQuotaStatus, typeof CheckCircle2> = {
	normal: CheckCircle2,
	warning: AlertTriangle,
	critical: OctagonAlert,
};

export function ApiQuotaStatusBadge({ status }: { status: ApiQuotaStatus }) {
	const Icon = STATUS_ICON[status];
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_STYLE[status]}`}
		>
			<Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
			{STATUS_LABEL[status]}
		</span>
	);
}
