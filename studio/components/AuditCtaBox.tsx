'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { PLANS } from '@/lib/plans';

interface AuditCtaBoxProps {
	onOpenPricing: () => void;
}

export function AuditCtaBox({ onOpenPricing }: AuditCtaBoxProps) {
	const t = useTranslations('audit.cta');
	const router = useRouter();
	const { status } = useSession();

	function handleClick() {
		if (status !== 'authenticated') {
			router.push('/login?callbackUrl=/');
			return;
		}
		onOpenPricing();
	}

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent p-6">
			<div>
				<p className="text-sm font-semibold text-slate-300">{t('line1')}</p>
				<p className="mt-1 text-lg font-bold text-white">
					{t('line2Pre')} <span className="text-accent-light">{t('line2Highlight')}</span> {t('line2Post')}
				</p>
			</div>
			<button
				onClick={handleClick}
				className="w-fit rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-light"
			>
				{t('button', { price: PLANS.pro.price.toLocaleString(), priceUsd: PLANS.pro.priceUsd })}
			</button>
			<p className="text-xs text-slate-500">{t('footnote')}</p>
		</div>
	);
}
