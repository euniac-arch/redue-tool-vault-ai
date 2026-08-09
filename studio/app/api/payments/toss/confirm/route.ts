import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { PLANS, type PlanId } from '@/lib/plans';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface ConfirmBody {
	paymentKey?: string;
	orderId?: string;
	amount?: number;
}

/**
 * POST /api/payments/toss/confirm — server-side confirmation step required
 * by Toss (the client-side redirect only tells us the payment *intends* to
 * be complete). Validates the amount against our own plan catalog before
 * trusting anything, then grants credits/plan and records the receipt.
 */
export async function POST(request: Request) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	const body = (await request.json().catch(() => ({}))) as ConfirmBody;
	const { paymentKey, orderId, amount } = body;

	if (!paymentKey || !orderId || typeof amount !== 'number') {
		return NextResponse.json({ error: '결제 정보가 올바르지 않습니다.' }, { status: 400 });
	}

	const planId = orderId.split('-')[0] as PlanId;
	const plan = PLANS[planId];
	if (!plan || plan.price !== amount) {
		return NextResponse.json({ error: '주문 금액이 요금제와 일치하지 않습니다.' }, { status: 400 });
	}

	const secretKey = process.env.TOSS_SECRET_KEY as string;
	const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
		method: 'POST',
		headers: {
			Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ paymentKey, orderId, amount }),
	});
	const tossData = await tossResponse.json();

	if (!tossResponse.ok) {
		await prisma.payment.create({
			data: {
				userId: session.user.id,
				planId: plan.id,
				amount,
				method: 'unknown',
				status: 'FAILED',
				tossPaymentKey: paymentKey,
				tossOrderId: orderId,
			},
		});
		return NextResponse.json({ error: tossData.message ?? '결제 승인에 실패했습니다.' }, { status: 402 });
	}

	const isMonthly = plan.cycle === 'monthly';
	const planRenewsAt = isMonthly ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined;

	const [, payment] = await prisma.$transaction([
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
				amount,
				method: tossData.method ?? 'unknown',
				status: 'DONE',
				tossPaymentKey: paymentKey,
				tossOrderId: orderId,
				receiptUrl: tossData.receipt?.url ?? null,
			},
		}),
		prisma.creditTransaction.create({
			data: { userId: session.user.id, delta: plan.credits, reason: isMonthly ? 'plan_grant' : 'purchase' },
		}),
	]);

	return NextResponse.json({ ok: true, plan: plan.name, creditsGranted: plan.credits, receiptUrl: payment.receiptUrl });
}
