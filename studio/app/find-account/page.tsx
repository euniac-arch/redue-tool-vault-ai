import { Suspense } from 'react';
import { FindAccountForm } from './FindAccountForm';

export default function FindAccountPage() {
	return (
		<div className="min-h-[70vh] bg-[#04101b] px-4 text-slate-300">
			<Suspense
				fallback={
					<div className="mx-auto flex min-h-[24rem] max-w-sm items-start py-10">
						<div className="h-8 w-40 rounded bg-slate-800/80" />
					</div>
				}
			>
				<FindAccountForm />
			</Suspense>
		</div>
	);
}
