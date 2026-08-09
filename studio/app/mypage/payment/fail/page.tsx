'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PaymentFailPage() {
	return (
		<Suspense fallback={null}>
			<PaymentFailInner />
		</Suspense>
	);
}

function PaymentFailInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const message = searchParams.get('message') ?? '결제가 취소되었거나 실패했습니다.';

	return (
		<main className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
			<div className="text-4xl">❌</div>
			<h1 className="text-xl font-bold text-white">결제 실패</h1>
			<p className="text-sm text-slate-400">{message}</p>
			<button
				onClick={() => router.push('/')}
				className="mt-4 rounded-lg border border-white/[0.08] bg-white/5 px-5 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/10"
			>
				다시 시도하기
			</button>
		</main>
	);
}
