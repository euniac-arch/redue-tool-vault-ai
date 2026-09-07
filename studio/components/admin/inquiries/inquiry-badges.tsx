import type { ContactInquiryStatus } from '@/lib/admin/inquiry-management';
import { INQUIRY_STATUS_LABEL, INQUIRY_TYPE_LABEL } from '@/lib/admin/inquiry-management';

const STATUS_STYLE: Record<ContactInquiryStatus, string> = {
	pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
	confirmed: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
	consulting: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
	completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
};

const STATUS_DOT: Record<ContactInquiryStatus, string> = {
	pending: 'bg-slate-400',
	confirmed: 'bg-sky-500',
	consulting: 'bg-amber-500',
	completed: 'bg-emerald-500',
};

const TYPE_STYLE: Record<string, string> = {
	geo: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-800',
	seo: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800',
	schema: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800',
	audit: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
	general: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-700',
	all: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-700',
};

export function InquiryStatusBadge({ status }: { status: ContactInquiryStatus }) {
	return (
		<span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}>
			<span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
			{INQUIRY_STATUS_LABEL[status]}
		</span>
	);
}

export function InquiryTypeBadge({
	inquiryType,
	serviceType,
}: {
	inquiryType: string;
	serviceType?: string | null;
}) {
	if (serviceType?.trim()) {
		return (
			<span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-700">
				{serviceType.trim()}
			</span>
		);
	}
	const style = TYPE_STYLE[inquiryType] || TYPE_STYLE.general;
	return (
		<span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${style}`}>
			{INQUIRY_TYPE_LABEL[inquiryType] || inquiryType || '기타 문의'}
		</span>
	);
}
