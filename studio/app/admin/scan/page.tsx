import { redirect } from 'next/navigation';

export default function AdminScanPage() {
	redirect('/admin/diagnostics/live');
}
