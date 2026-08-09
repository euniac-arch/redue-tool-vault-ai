'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PaymentSuccessPage() {
	return (
		<Suspense fallback={null}>
			<PaymentSuccessInner />
		</Suspense>
	);
}

function PaymentSuccessInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [status, setStatus] = useState<'confirming' | 'done' | 'error'>('confirming');
	const [message, setMessage] = useState('결제를 확인하고 있습니다...');

	useEffect(() => {
		const paymentKey = searchParams.get('paymentKey');
		const orderId = searchParams.get('orderId');
		const amount = searchParams.get('amount');

		if (!paymentKey || !orderId || !amount) {
			setStatus('error');
			setMessage('결제 정보를 확인할 수 없습니다.');
			return;
		}

		fetch('/api/payments/toss/confirm', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
		})
			.then(async (res) => {
				const data = await res.json();
				if (!res.ok) throw new Error(data.error ?? '결제 확인 중 오류가 발생했습니다.');
				setStatus('done');
				setMessage(`${data.plan} 결제가 완료되었습니다. 크레딧 ${data.creditsGranted}회가 지급되었습니다.`);
			})
			.catch((err) => {
				setStatus('error');
				setMessage((err as Error).message);
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<main className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
			<div className="text-4xl">{status === 'done' ? '✅' : status === 'error' ? '⚠️' : '⏳'}</div>
			<h1 className="text-xl font-bold text-white">
				{status === 'done' ? '결제 완료' : status === 'error' ? '결제 확인 실패' : '결제 확인 중'}
			</h1>
			<p className="text-sm text-slate-400">{message}</p>
			<button
				onClick={() => router.push('/mypage')}
				className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-light"
			>
				마이페이지로 이동
			</button>
		</main>
	);
}
