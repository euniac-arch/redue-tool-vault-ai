import type { ReactNode } from 'react';
import { SECTION_DESC, SECTION_NO, SECTION_TITLE } from '@/components/strategy/strategy-ui';

export function StudioSectionHeader({
	no,
	title,
	description,
	id,
	action,
}: {
	no: string;
	title: string;
	description?: string;
	id?: string;
	action?: ReactNode;
}) {
	return (
		<header id={id} className="mb-8">
			<p className={SECTION_NO}>{no}</p>
			<div className="mt-2 flex flex-wrap items-start justify-between gap-3">
				<h2 className={SECTION_TITLE}>{title}</h2>
				{action}
			</div>
			{description ? <p className={SECTION_DESC}>{description}</p> : null}
		</header>
	);
}
