'use client';

import { useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';

export function isAuditMemberSignedIn(
	session: { user?: { id?: string | null } | null } | null | undefined,
): boolean {
	return Boolean(session?.user?.id);
}

/**
 * Shared guest lock used by the floating share bar and in-report PDF CTA.
 * Clicking a member-only action opens the same AuthModal instead of running
 * the download / email pipeline.
 */
export function useAuditMemberGate() {
	const { data: session } = useSession();
	const signedIn = isAuditMemberSignedIn(session);
	const [authModalOpen, setAuthModalOpen] = useState(false);
	const [authModalMessage, setAuthModalMessage] = useState('');

	const requireMember = useCallback(
		(message: string) => {
			if (signedIn) return true;
			setAuthModalMessage(message);
			setAuthModalOpen(true);
			return false;
		},
		[signedIn],
	);

	const closeAuthModal = useCallback(() => {
		setAuthModalOpen(false);
	}, []);

	return {
		signedIn,
		authModalOpen,
		authModalMessage,
		requireMember,
		closeAuthModal,
		setAuthModalOpen,
	};
}
