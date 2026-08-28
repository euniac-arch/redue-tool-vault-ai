import { redirect } from 'next/navigation';

export default function AdminHistoryRedirectPage() {
	redirect('/admin/diagnostics');
}
