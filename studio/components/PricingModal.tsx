'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';
import { getPurchasablePlans, PLANS, type PlanDefinition } from '@/lib/plans';

interface PricingModalProps {
	open: boolean;
	onClose: () => void;
}

type PaymentMethod = 'toss' | 'stripe';

/**
 * Renders the 4 pricing tiers, then a checkout step for the selected
 * payment method. Domestic (KRW) checkout uses Toss Payments' official
 * public docs test key so it genuinely works with zero setup — see
 * `.env.example`. Overseas (USD) checkout uses Stripe Checkout Sessions
 * (`/api/payments/stripe/checkout`), which requires your own Stripe test
 * `STRIPE_SECRET_KEY` since Stripe has no public shared test key.
 */
export function PricingModal({ open, onClose }: PricingModalProps) {
	const { data: session } = useSession();
	const [method, setMethod] = useState<PaymentMethod>('toss');
	const [selectedPlan, setSelectedPlan] = useState<PlanDefinition | null>(null);
	const [checkoutReady, setCheckoutReady] = useState(false);
	const [checkoutError, setCheckoutError] = useState<string | null>(null);
	const [paying, setPaying] = useState(false);
	const widgetsRef = useRef<TossPaymentsWidgets | null>(null);

	useEffect(() => {
		if (!open) {
			setSelectedPlan(null);
			setCheckoutReady(false);
			setCheckoutError(null);
			widgetsRef.current = null;
		}
	}, [open]);

	useEffect(() => {
		if (!selectedPlan || !session?.user?.id || method !== 'toss') {
			return;
		}
		let cancelled = false;
		setCheckoutReady(false);
		setCheckoutError(null);

		(async () => {
			try {
				const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
				const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY as string;
				const tossPayments = await loadTossPayments(clientKey);
				const widgets = tossPayments.widgets({ customerKey: session.user.id as string });
				if (cancelled) return;
				widgetsRef.current = widgets;
				await widgets.setAmount({ currency: 'KRW', value: selectedPlan.price });
				await widgets.renderPaymentMethods({ selector: '#toss-payment-method' });
				await widgets.renderAgreement({ selector: '#toss-agreement' });
				if (!cancelled) setCheckoutReady(true);
			} catch (err) {
				if (!cancelled) setCheckoutError((err as Error).message ?? '결제 위젯을 불러오지 못했습니다.');
			}
		})();

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedPlan, session?.user?.id, method]);

	if (!open) {
		return null;
	}

	async function handlePayToss() {
		if (!selectedPlan || !widgetsRef.current) return;
		setPaying(true);
		setCheckoutError(null);
		try {
			const orderId = `${selectedPlan.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			await widgetsRef.current.requestPayment({
				orderId,
				orderName: `REDUE AI Studio — ${selectedPlan.name}`,
				successUrl: `${window.location.origin}/mypage/payment/success`,
				failUrl: `${window.location.origin}/mypage/payment/fail`,
				customerEmail: session?.user?.email ?? undefined,
				customerName: session?.user?.name ?? undefined,
			});
		} catch (err) {
			setCheckoutError((err as Error).message ?? '결제 요청 중 오류가 발생했습니다.');
			setPaying(false);
		}
	}

	async function handlePayStripe() {
		if (!selectedPlan) return;
		setPaying(true);
		setCheckoutError(null);
		try {
			const res = await fetch('/api/payments/stripe/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ planId: selectedPlan.id }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Stripe checkout failed.');
			window.location.href = data.url;
		} catch (err) {
			setCheckoutError((err as Error).message ?? 'Stripe checkout failed.');
			setPaying(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
			<div
				className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-5 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0C0D0E] p-6"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="text-xl font-bold text-white">{selectedPlan ? `${selectedPlan.name} 결제` : '요금제 선택'}</h2>
						<p className="mt-1 text-sm text-slate-400">
							{selectedPlan
								? method === 'toss'
									? '토스페이먼츠 테스트 결제창입니다 (테스트 카드: 4330-0000-0000-0000).'
									: 'Stripe Checkout으로 이동합니다 (해외 카드, USD 결제).'
								: '필요한 만큼만 합리적으로.'}
						</p>
					</div>
					<button
						onClick={onClose}
						className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-sm text-slate-400 hover:bg-white/10"
					>
						✕
					</button>
				</div>

				<div className="flex items-center gap-1 self-start rounded-full border border-white/[0.08] bg-white/5 p-1 text-xs font-bold">
					<button
						onClick={() => setMethod('toss')}
						className={`rounded-full px-3 py-1.5 transition ${method === 'toss' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
					>
						🇰🇷 국내 카드 (Toss / KRW)
					</button>
					<button
						onClick={() => setMethod('stripe')}
						className={`rounded-full px-3 py-1.5 transition ${method === 'stripe' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
					>
						🌍 해외 카드 (Stripe / USD)
					</button>
				</div>

				{!selectedPlan && (
					<>
						<div className="grid gap-4 sm:grid-cols-2">
							<PlanCard plan={PLANS.starter} method={method} disabled label="가입 시 자동 지급" />
							{getPurchasablePlans().map((plan) => (
								<PlanCard key={plan.id} plan={plan} method={method} onSelect={() => setSelectedPlan(plan)} label="선택하기" />
							))}
						</div>
						<a
							href="/enterprise"
							onClick={onClose}
							className="flex items-center justify-between rounded-xl border border-amber-400/25 bg-gradient-to-r from-amber-400/[0.07] to-cyan-400/[0.06] p-4 transition hover:border-amber-400/40"
						>
							<div>
								<div className="flex items-center gap-2">
									<span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
										Enterprise
									</span>
									<span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
										On-Prem
									</span>
								</div>
								<p className="mt-2 text-sm font-bold text-white">대규모·온프레미스 맞춤 도입</p>
								<p className="mt-0.5 text-xs text-slate-400">
									Docker 에이전트 · SLA 99.9% · 전담 지원 — 50개 이상 사이트 운영 기업 대상
								</p>
							</div>
							<span className="shrink-0 text-sm font-semibold text-amber-300">상담 신청 →</span>
						</a>
					</>
				)}

				{selectedPlan && method === 'toss' && (
					<div className="flex flex-col gap-4">
						<button onClick={() => setSelectedPlan(null)} className="self-start text-xs text-slate-400 hover:text-white">
							← 요금제 다시 선택
						</button>

						<div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
							<p className="text-sm font-semibold text-white">{selectedPlan.name}</p>
							<p className="text-2xl font-extrabold text-indigo-300">₩{selectedPlan.price.toLocaleString()}</p>
							<p className="mt-1 text-xs text-slate-500">{selectedPlan.description}</p>
						</div>

						<div id="toss-payment-method" />
						<div id="toss-agreement" />

						{checkoutError && <p className="text-sm text-rose-400">{checkoutError}</p>}

						<button
							onClick={handlePayToss}
							disabled={!checkoutReady || paying}
							className="rounded-lg bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-light disabled:opacity-50"
						>
							{paying ? '결제 요청 중...' : checkoutReady ? `₩${selectedPlan.price.toLocaleString()} 결제하기` : '결제창 준비 중...'}
						</button>
					</div>
				)}

				{selectedPlan && method === 'stripe' && (
					<div className="flex flex-col gap-4">
						<button onClick={() => setSelectedPlan(null)} className="self-start text-xs text-slate-400 hover:text-white">
							← Choose a different plan
						</button>

						<div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
							<p className="text-sm font-semibold text-white">{selectedPlan.name}</p>
							<p className="text-2xl font-extrabold text-indigo-300">${selectedPlan.priceUsd.toLocaleString()}</p>
							<p className="mt-1 text-xs text-slate-500">
								{selectedPlan.cycle === 'monthly' ? 'Billed monthly' : 'One-time charge'} · redirects to Stripe Checkout
							</p>
						</div>

						{checkoutError && <p className="text-sm text-rose-400">{checkoutError}</p>}

						<button
							onClick={handlePayStripe}
							disabled={paying}
							className="rounded-lg bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-light disabled:opacity-50"
						>
							{paying ? 'Redirecting to Stripe...' : `Pay $${selectedPlan.priceUsd.toLocaleString()} with Stripe`}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

function PlanCard({
	plan,
	method,
	onSelect,
	disabled,
	label,
}: {
	plan: PlanDefinition;
	method: PaymentMethod;
	onSelect?: () => void;
	disabled?: boolean;
	label: string;
}) {
	return (
		<div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
			<div className="flex items-center justify-between">
				<p className="text-sm font-bold text-white">{plan.name}</p>
				{plan.cycle === 'monthly' && (
					<span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">월 정기</span>
				)}
			</div>
			<p className="text-xl font-extrabold text-indigo-300">
				{method === 'stripe'
					? plan.priceUsd === 0
						? 'Free'
						: `$${plan.priceUsd.toLocaleString()}`
					: plan.price === 0
						? '무료'
						: `₩${plan.price.toLocaleString()}`}
			</p>
			<p className="text-xs text-slate-500">{plan.description}</p>
			<ul className="flex flex-col gap-1 text-xs text-slate-400">
				{plan.perks.map((perk) => (
					<li key={perk}>· {perk}</li>
				))}
			</ul>
			<button
				onClick={onSelect}
				disabled={disabled}
				className="mt-2 rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-xs font-bold text-slate-100 hover:bg-white/10 disabled:cursor-default disabled:opacity-50"
			>
				{label}
			</button>
		</div>
	);
}
