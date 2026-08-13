import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';

/**
 * Admin-only layout: Left Sidebar (fixed) + Right column (Header + scrollable main).
 * Independent from the public marketing Header (see ConditionalAppShell).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
	const firebaseConfigured = isFirebaseAdminConfigured();

	return <AdminShell firebaseConfigured={firebaseConfigured}>{children}</AdminShell>;
}
