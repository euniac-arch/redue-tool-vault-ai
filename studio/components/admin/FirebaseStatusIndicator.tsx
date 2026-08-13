'use client';

interface FirebaseStatusIndicatorProps {
	configured: boolean;
}

export function FirebaseStatusIndicator({ configured }: FirebaseStatusIndicatorProps) {
	return (
		<div
			className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600"
			title={configured ? 'Firebase Admin SDK configured' : 'Firebase Admin SDK not configured'}
			role="status"
			aria-label={configured ? 'Firebase DB 연결됨' : 'Firebase DB 미설정'}
		>
			<span
				className={`h-2 w-2 shrink-0 rounded-full ${
					configured ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]' : 'bg-amber-400'
				}`}
				aria-hidden
			/>
			<span className="hidden sm:inline">{configured ? 'Firebase DB' : 'Firebase 미설정'}</span>
			<span className={`hidden md:inline ${configured ? 'text-emerald-600' : 'text-amber-600'}`}>
				{configured ? 'Connected' : 'Offline'}
			</span>
		</div>
	);
}
