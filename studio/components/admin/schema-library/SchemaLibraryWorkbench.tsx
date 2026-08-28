'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import {
	EMPTY_SCHEMA_TEMPLATE_PARAMS,
	SCHEMA_LIBRARY_SAMPLE,
	buildGoogleRichResultsUrl,
	cloneSchemaTemplateParams,
	generateSchemaTemplate,
	type SchemaCmsPlatform,
	type SchemaTemplateParams,
} from '@/lib/schema/schemaTemplateService';
import { CmsPlatformTabs } from './CmsPlatformTabs';
import { SchemaCodeViewer } from './SchemaCodeViewer';
import { SchemaParamForm } from './SchemaParamForm';

export function SchemaLibraryWorkbench() {
	const [cms, setCms] = useState<SchemaCmsPlatform>('gnuboard');
	const [params, setParams] = useState<SchemaTemplateParams>(() =>
		cloneSchemaTemplateParams(EMPTY_SCHEMA_TEMPLATE_PARAMS),
	);

	const result = useMemo(() => generateSchemaTemplate(cms, params), [cms, params]);
	const richResultsUrl = useMemo(() => buildGoogleRichResultsUrl(params.siteUrl), [params.siteUrl]);

	function loadSample() {
		setParams(cloneSchemaTemplateParams(SCHEMA_LIBRARY_SAMPLE));
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
						Solve Workspace
					</p>
					<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
						CMS별 주입 코드 라이브러리
					</h1>
					<p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
						그누보드 5, 워드프레스, 라이믹스, 표준 HTML/SPA용 JSON-LD 주입 템플릿과
						그누보드/영카트용 rss.php (RSS 2.0) 피드를 변수 입력에 따라 실시간으로 생성합니다.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={loadSample}
						className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
					>
						<Sparkles className="h-3.5 w-3.5" aria-hidden />
						기본 샘플 데이터 불러오기
					</button>
					<a
						href={richResultsUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
					>
						<ExternalLink className="h-3.5 w-3.5" aria-hidden />
						Google 리치 검색결과 테스트 바로가기
					</a>
				</div>
			</div>

			<CmsPlatformTabs value={cms} onChange={setCms} />

			<div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
				<SchemaParamForm value={params} onChange={setParams} onLoadSample={loadSample} />
				<SchemaCodeViewer result={result} richResultsUrl={richResultsUrl} />
			</div>
		</div>
	);
}
