export function StoryHeading({
	kicker,
	title,
	titleLine2,
	subtitle,
	id,
	size = 'default',
}: {
	kicker?: string;
	title: string;
	titleLine2?: string;
	subtitle?: string;
	id?: string;
	size?: 'default' | 'lg';
}) {
	const titleClass =
		size === 'lg'
			? 'mt-2 break-keep text-[26px] font-extrabold leading-snug tracking-tight text-white sm:text-[34px]'
			: 'mt-2 break-keep text-2xl font-extrabold leading-snug text-slate-100 sm:text-[28px]';

	return (
		<div className="mx-auto max-w-3xl text-center">
			{kicker ? (
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">{kicker}</p>
			) : null}
			<h2 id={id} className={titleClass}>
				<span className="block">{title}</span>
				{titleLine2 ? <span className="block">{titleLine2}</span> : null}
			</h2>
			{subtitle ? (
				<p className="mt-3 break-keep text-sm leading-relaxed text-slate-400 sm:text-[15px]">{subtitle}</p>
			) : null}
		</div>
	);
}
