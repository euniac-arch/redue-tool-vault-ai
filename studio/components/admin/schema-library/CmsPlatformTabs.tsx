'use client';

import { SCHEMA_CMS_TABS, type SchemaCmsPlatform } from '@/lib/schema/schemaTemplateService';

interface CmsPlatformTabsProps {
	value: SchemaCmsPlatform;
	onChange: (cms: SchemaCmsPlatform) => void;
}

export function CmsPlatformTabs({ value, onChange }: CmsPlatformTabsProps) {
	return (
		<nav
			className="grid grid-cols-1 gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-700 dark:bg-slate-800"
			aria-label="CMS 플랫폼 선택"
		>
			{SCHEMA_CMS_TABS.map((tab) => {
				const active = value === tab.id;
				return (
					<button
						key={tab.id}
						type="button"
						onClick={() => onChange(tab.id)}
						aria-pressed={active}
						className={`rounded-lg px-3 py-2.5 text-center text-sm font-bold transition ${
							active
								? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
								: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100'
						}`}
					>
						{tab.label}
					</button>
				);
			})}
		</nav>
	);
}
