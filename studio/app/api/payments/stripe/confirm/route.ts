import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { PLANS, type PlanId } from '@/lib/plans';
import { prisma } from '@/lib/prisma';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe';

export const runtime = 'nodejs';

interface ConfirmBody {
	sessionId?: string;
}

/**
 * POST /api/payments/stripe/confirm — the Checkout success page calls this
 * to verify payment status server-side (Stripe Checkout marks `payment_status`
 * as "paid" synchronously for card payments) before granting credits/plan.
 * Idempotent: re-confirming the same `session_id` will not double-grant.
 */
export async function POST(request: Request) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Login required.' }, { status: 401 });
	}
	if (!isStripeConfigured()) {
		return NextResponse.json({ error: 'Stripe is not configured on this server.' }, { status: 503 });
	}

	const body = (await request.json().catch(() => ({}))) as ConfirmBody;
	if (!body.sessionId) {
		return NextResponse.json({ error: 'Missing sessionId.' }, { status: 400 });
	}

	const existing = await prisma.payment.findFirst({ where: { stripeSessionId: body.sessionId } });
	if (existing) {
		const plan = PLANS[existing.planId as PlanId];
		return NextResponse.json({ ok: true, plan: plan?.name ?? existing.planId, creditsGranted: plan?.credits ?? 0, alreadyConfirmed: true });
	}

	const stripe = getStripeClient();
	const checkoutSession = await stripe.checkout.sessions.retrieve(body.sessionId);

	if (checkoutSession.client_reference_id !== session.user.id) {
		return NextResponse.json({ error: 'This checkout session does not belong to your account.' }, { status: 403 });
	}
	if (checkoutSession.payment_status !== 'paid') {
		return NextResponse.json({ error: `Payment not completed (status: ${checkoutSession.payment_status}).` }, { status: 402 });
	}

	const planId = checkoutSession.metadata?.planId as PlanId | undefined;
	const plan = planId ? PLANS[planId] : null;
	if (!plan) {
		return NextResponse.json({ error: 'Unknown plan on this checkout session.' }, { status: 400 });
	}

	const isMonthly = plan.cycle === 'monthly';
	const planRenewsAt = isMonthly ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined;
	const amountUsd = Math.round((checkoutSession.amount_total ?? plan.priceUsd * 100) / 100);

	await prisma.$transaction([
		prisma.user.update({
			where: { id: session.user.id },
			data: {
				creditsRemaining: { increment: plan.credits },
				...(isMonthly ? { planId: plan.id, planRenewsAt } : {}),
			},
		}),
		prisma.payment.create({
			data: {
				userId: session.user.id,
				planId: plan.id,
				amount: amountUsd,
				currency: 'USD',
				method: 'card',
				provider: 'stripe',
				status: 'DONE',
				stripeSessionId: body.sessionId,
			},
		}),
		prisma.creditTransaction.create({
			data: { userId: session.user.id, delta: plan.credits, reason: isMonthly ? 'plan_grant_stripe' : 'purchase_stripe' },
		}),
	]);

	return NextResponse.json({ ok: true, plan: plan.name, creditsGranted: plan.credits });
}
