'use client';

import { useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { AuditPayloadProvider } from '@/components/audit/AuditPayloadProvider';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

/** Clear leftover service workers from other localhost apps / old PWA experiments. */
function useClearStaleServiceWorkers() {
	useEffect(() => {
		if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

		void navigator.serviceWorker.getRegistrations().then((regs) => {
			for (const reg of regs) {
				void reg.unregister();
			}
		});

		if ('caches' in window) {
			void caches.keys().then((keys) => {
				for (const key of keys) {
					void caches.delete(key);
				}
			});
		}
	}, []);
}

export function Providers({ session, children }: { session: Session | null; children: React.ReactNode }) {
	useClearStaleServiceWorkers();
	return (
		<SessionProvider session={session}>
			<ThemeProvider>
				<AuditPayloadProvider>{children}</AuditPayloadProvider>
			</ThemeProvider>
		</SessionProvider>
	);
}
