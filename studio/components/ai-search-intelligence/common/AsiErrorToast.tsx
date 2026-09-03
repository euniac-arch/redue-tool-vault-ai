export function AsiErrorToast({ message }: { message: string | null }) {
	if (!message) return null;
	return (
		<div
			role="status"
			className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 shadow-lg dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-200"
		>
			{message}
		</div>
	);
}
