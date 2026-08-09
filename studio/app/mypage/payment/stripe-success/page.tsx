'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function StripeSuccessPage() {
	return (
		<Suspense fallback={null}>
			<StripeSuccessInner />
		</Suspense>
	);
}

function StripeSuccessInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [status, setStatus] = useState<'confirming' | 'done' | 'error'>('confirming');
	const [message, setMessage] = useState('Confirming your payment...');

	useEffect(() => {
		const sessionId = searchParams.get('session_id');
		if (!sessionId) {
			setStatus('error');
			setMessage('Missing Stripe session id.');
			return;
		}

		fetch('/api/payments/stripe/confirm', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sessionId }),
		})
			.then(async (res) => {
				const data = await res.json();
				if (!res.ok) throw new Error(data.error ?? 'Payment confirmation failed.');
				setStatus('done');
				setMessage(`${data.plan} activated — ${data.creditsGranted} credits granted.`);
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
				{status === 'done' ? 'Payment complete' : status === 'error' ? 'Confirmation failed' : 'Confirming payment'}
			</h1>
			<p className="text-sm text-slate-400">{message}</p>
			<button
				onClick={() => router.push('/mypage')}
				className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-light"
			>
				Go to My Page
			</button>
		</main>
	);
}
