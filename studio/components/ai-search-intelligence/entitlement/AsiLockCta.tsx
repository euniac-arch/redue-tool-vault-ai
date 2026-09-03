'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AuthModal } from '@/components/AuthModal';
import { PricingModal } from '@/components/PricingModal';
import { asiHrefForFeature, resolveAsiLockIntent, type AsiFeatureId } from '@/lib/ai-search-intelligence/entitlement';
import { useAsiActor } from '@/lib/ai-search-intelligence/entitlement/use-asi-actor';
import { ASI_CTA } from '@/lib/ui/asi-chrome';

export function AsiLockCta({ feature, label }: { feature: AsiFeatureId; label: string }) {
	const t = useTranslations('intelligence.lock');
	const { actor, ready } = useAsiActor();
	const [auth, setAuth] = useState(false);
	const [pricing, setPricing] = useState(false);
	const intent = ready ? resolveAsiLockIntent(actor, feature) : 'login';
	const href = asiHrefForFeature(feature);

	if (intent === 'enter') {
		return (
			<Link href={href} className={ASI_CTA}>
				{label}
			</Link>
		);
	}

	if (intent === 'login') {
		return (
			<>
				<button type="button" className={ASI_CTA} disabled={!ready} onClick={() => setAuth(true)}>
					{label}
				</button>
				<AuthModal open={auth} onClose={() => setAuth(false)} message={t('loginMessage')} hideBenefits />
			</>
		);
	}

	return (
		<>
			<button type="button" className={ASI_CTA} onClick={() => setPricing(true)}>
				{label}
			</button>
			<PricingModal open={pricing} onClose={() => setPricing(false)} />
		</>
	);
}
