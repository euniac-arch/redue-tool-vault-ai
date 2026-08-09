import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { PLANS, type PlanId } from '@/lib/plans';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe';

export const runtime = 'nodejs';

interface CheckoutBody {
	planId?: string;
}

function resolveOrigin() {
	const store = headers();
	const proto = store.get('x-forwarded-proto') ?? 'http';
	const host = store.get('x-forwarded-host') ?? store.get('host');
	return host ? `${proto}://${host}` : process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

/**
 * POST /api/payments/stripe/checkout — creates a Stripe Checkout Session for
 * overseas (USD) customers. Plans are recurring monthly Prices built inline
 * with `price_data` + `recurring`, so no pre-provisioned Stripe Dashboard
 * Price objects are required — just a Stripe account & `STRIPE_SECRET_KEY`.
 */
export async function POST(request: Request) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: 'Login required.' }, { status: 401 });
	}
	if (!isStripeConfigured()) {
		return NextResponse.json(
			{ error: 'Stripe is not configured on this server. Set STRIPE_SECRET_KEY in .env (see .env.example).' },
			{ status: 503 }
		);
	}

	const body = (await request.json().catch(() => ({}))) as CheckoutBody;
	const planId = body.planId as PlanId;
	const plan = PLANS[planId];
	if (!plan || plan.priceUsd <= 0) {
		return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
	}

	const origin = resolveOrigin();
	const stripe = getStripeClient();

	const checkoutSession = await stripe.checkout.sessions.create({
		mode: plan.cycle === 'monthly' ? 'subscription' : 'payment',
		client_reference_id: session.user.id,
		customer_email: session.user.email ?? undefined,
		metadata: { userId: session.user.id, planId: plan.id },
		line_items: [
			{
				price_data: {
					currency: 'usd',
					unit_amount: Math.round(plan.priceUsd * 100),
					product_data: { name: `REDUE AI Studio — ${plan.name}`, description: plan.description },
					...(plan.cycle === 'monthly' ? { recurring: { interval: 'month' as const } } : {}),
				},
				quantity: 1,
			},
		],
		success_url: `${origin}/mypage/payment/stripe-success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${origin}/mypage?checkout=cancelled`,
	});

	return NextResponse.json({ url: checkoutSession.url });
}
