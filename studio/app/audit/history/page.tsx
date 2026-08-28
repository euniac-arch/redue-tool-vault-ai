import { redirect } from 'next/navigation';

/** Canonical history lives on the diagnostic engine: `/audit?tab=history`. */
export default function AuditHistoryPage() {
	redirect('/audit?tab=history');
}
