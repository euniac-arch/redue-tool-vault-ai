'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MarkdownBodyEditor } from '@/components/admin/naver-blog/MarkdownBodyEditor';
import {
	ProjectSearchSelect,
	type RecentProjectChip,
} from '@/components/admin/naver-blog/ProjectSearchSelect';
import {
	DEFAULT_TREATMENT_TOPICS,
	extractProjectCode,
	getKeywordSuggestions,
	getTopicsForProject,
} from '@/lib/naver-blog/topics';
import type { ProjectListItem } from '@/lib/projects';

type PublishStatus = 'draft' | 'scheduled' | 'published';

type FaqItem = {
	id: string;
	question: string;
	answer: string;
};

type BlogDraft = {
	id: string;
	projectId: string;
	projectName: string;
	projectCode: string;
	topic: string;
	keyword: string;
	title: string;
	body: string;
	faqs: FaqItem[];
	hashtags: string[];
	canonicalUrl: string;
	status: PublishStatus;
	createdAt: string;
	hasGeoFaq: boolean;
};

const RECENT_KEY = 'redue_naver_blog_recent_projects';
const DRAFTS_KEY = 'redue_naver_blog_drafts';

const FALLBACK_PROJECTS: ProjectListItem[] = [
	{
		id: 'koreaionlab',
		name: '한국중입자 암치료연구소',
		targetUrl: 'https://koreaionlab.com',
		cmsType: 'Gnuboard',
		category: 'MEDICAL',
		categoryLabel: '의료/병원',
		status: 'ACTIVE',
		thumbnailUrl: null,
		latestScore: 72,
		latestSeoScore: 70,
		latestGeoScore: 68,
		latestSchemaScore: 60,
		latestAuditId: null,
		auditCount: 3,
		createdAt: '2026-07-01T00:00:00.000Z',
	},
	{
		id: 'demo-clinic',
		name: '레드유 클리닉 데모',
		targetUrl: 'https://demo-clinic.redue.ai',
		cmsType: 'WordPress',
		category: 'MEDICAL',
		categoryLabel: '의료/병원',
		status: 'ACTIVE',
		thumbnailUrl: null,
		latestScore: 64,
		latestSeoScore: 62,
		latestGeoScore: 55,
		latestSchemaScore: 40,
		latestAuditId: null,
		auditCount: 1,
		createdAt: '2026-07-15T00:00:00.000Z',
	},
];

const STATUS_LABEL: Record<PublishStatus, string> = {
	draft: '초안',
	scheduled: '예약',
	published: '발행완료',
};

const STATUS_STYLE: Record<PublishStatus, string> = {
	draft: 'bg-slate-100 text-slate-700 ring-slate-200',
	scheduled: 'bg-amber-50 text-amber-800 ring-amber-200',
	published: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

function formatDate(iso: string): string {
	try {
		return new Intl.DateTimeFormat('ko-KR', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(iso));
	} catch {
		return iso.slice(0, 10);
	}
}

function seedDrafts(): BlogDraft[] {
	return [
		{
			id: 'nb-1',
			projectId: 'koreaionlab',
			projectName: '한국중입자 암치료연구소',
			projectCode: 'koreaionlab',
			topic: '중입자 치료',
			keyword: '일본 중입자 치료 비용',
			title: '일본 중입자 치료 비용, 실제 환자들이 확인하는 기준은?',
			body: [
				'## 일본 중입자 치료 비용에 대해 궁금한 점부터 정리합니다',
				'',
				'중입자 치료는 정밀한 입자선으로 암세포를 집중 조사하는 치료법입니다.',
				'',
				'비용은 암종·병기·치료 계획에 따라 달라지며, 해외 의료 코디네이션을 통해 사전 적합성 검토가 중요합니다.',
			].join('\n'),
			faqs: [
				{
					id: 'f1',
					question: '일본 중입자 치료 비용은 어떻게 산정되나요?',
					answer:
						'암종, 병기, 조사 횟수, 병원별 프로토콜에 따라 달라집니다. 사전 상담으로 대략 범위를 확인할 수 있습니다.',
				},
				{
					id: 'f2',
					question: '중입자 치료가 적합한지 어떻게 알 수 있나요?',
					answer:
						'영상·병리 자료를 바탕으로 대상 여부를 검토합니다. 모든 암종에 적용되는 것은 아닙니다.',
				},
				{
					id: 'f3',
					question: '상담 전에 준비하면 좋은 자료는?',
					answer:
						'최근 영상 검사, 병리 결과, 치료 이력, 복용 중인 약물이 있으면 상담이 더 정확해집니다.',
				},
			],
			hashtags: ['#중입자치료', '#일본암치료', '#해외암치료', '#중입자치료비용'],
			canonicalUrl: 'https://koreaionlab.com/301.php',
			status: 'draft',
			createdAt: '2026-08-10T09:20:00.000Z',
			hasGeoFaq: true,
		},
		{
			id: 'nb-2',
			projectId: 'koreaionlab',
			projectName: '한국중입자 암치료연구소',
			projectCode: 'koreaionlab',
			topic: 'iNKT 세포치료',
			keyword: '해외 암치료 전문병원',
			title: '해외 암치료 전문병원 선택 시 체크해야 할 GEO 포인트',
			body: 'AI 검색 환경에서는 병원명·치료법·FAQ가 명확히 구조화된 콘텐츠가 인용될 가능성이 높습니다.',
			faqs: [
				{
					id: 'f3',
					question: '해외 암치료 전문병원은 어떤 기준으로 고르나요?',
					answer:
						'치료 실적, 적용 암종, 다학제 협진 체계, 사후 관리 프로세스를 함께 확인하는 것이 좋습니다.',
				},
				{
					id: 'f4',
					question: 'GEO 관점에서 FAQ가 왜 중요한가요?',
					answer:
						'생성형 검색이 질문·답변 단위로 인용하기 쉽도록, 정의와 선택 기준을 짧게 분리해 두는 것이 유리합니다.',
				},
				{
					id: 'f5',
					question: '상담 전에 준비하면 좋은 자료는?',
					answer:
						'최근 영상 검사, 병리 결과, 치료 이력, 복용 중인 약물이 있으면 상담이 더 정확해집니다.',
				},
			],
			hashtags: ['#iNKT', '#세포치료', '#해외암치료', '#GEO'],
			canonicalUrl: 'https://koreaionlab.com/',
			status: 'scheduled',
			createdAt: '2026-08-08T14:05:00.000Z',
			hasGeoFaq: true,
		},
		{
			id: 'nb-3',
			projectId: 'demo-clinic',
			projectName: '레드유 클리닉 데모',
			projectCode: 'demo-clinic',
			topic: '줄기세포치료',
			keyword: '줄기세포치료 후기',
			title: '줄기세포치료 후기보다 먼저 확인할 의학적 기준',
			body: '후기만으로 판단하기보다 적응증과 안전성 정보를 우선 확인하세요.',
			faqs: [],
			hashtags: ['#줄기세포치료', '#재생의료'],
			canonicalUrl: 'https://demo-clinic.redue.ai/',
			status: 'published',
			createdAt: '2026-08-05T11:40:00.000Z',
			hasGeoFaq: false,
		},
	];
}

function buildGeneratedDraft(input: {
	project: ProjectListItem;
	topic: string;
	keyword: string;
}): BlogDraft {
	const projectName = input.project.name;
	const projectCode = extractProjectCode(input.project);
	const keyword = input.keyword.trim() || input.topic;
	const origin = (() => {
		try {
			return new URL(input.project.targetUrl).origin;
		} catch {
			return input.project.targetUrl;
		}
	})();
	const title = `${keyword}, ${input.topic} 관점에서 꼭 알아야 할 핵심 정리`;
	const body = [
		`## ${keyword}에 대해 궁금한 점부터 정리합니다`,
		'',
		`${projectName} 기준으로 "${input.topic}"와 관련된 검색 의도를 반영한 네이버 블로그용 초안입니다.`,
		'',
		`### 왜 ${input.topic}가 중요한가`,
		`- 검색 키워드 "${keyword}"로 유입되는 독자는 치료 적합성·비용·병원 선택 기준을 동시에 확인합니다.`,
		`- GEO(생성형 엔진 최적화)를 위해 정의·절차·FAQ를 명확히 분리해 작성했습니다.`,
		'',
		'### 핵심 요약',
		`1. ${input.topic}의 기본 개념을 쉬운 문장으로 설명합니다.`,
		'2. 대상자와 사전 검토 포인트를 구분합니다.',
		'3. AI 검색이 인용하기 쉬운 Q&A를 하단에 배치합니다.',
		'',
		'※ 본 원고는 AI 초안이며, 발행 전 의료·광고 규정에 맞게 검수하세요.',
	].join('\n');

	const faqs: FaqItem[] = [
		{
			id: crypto.randomUUID(),
			question: `${keyword}란 무엇인가요?`,
			answer: `${input.topic}와 연관된 질문으로, 정의·적용 범위·사전 상담 필요성을 짧게 안내합니다.`,
		},
		{
			id: crypto.randomUUID(),
			question: `${input.topic}는 누구에게 적합할까요?`,
			answer:
				'암종·병기·전신 상태에 따라 달라지며, 영상·병리 자료 기반의 적합성 검토가 필요합니다.',
		},
		{
			id: crypto.randomUUID(),
			question: '상담 전에 준비하면 좋은 자료는?',
			answer:
				'최근 영상 검사, 병리 결과, 치료 이력, 복용 중인 약물이 있으면 상담이 더 정확해집니다.',
		},
	];

	const tagBase = input.topic.replace(/\s+/g, '');
	return {
		id: crypto.randomUUID(),
		projectId: input.project.id,
		projectName,
		projectCode,
		topic: input.topic,
		keyword,
		title,
		body,
		faqs,
		hashtags: [`#${tagBase}`, `#${keyword.replace(/\s+/g, '')}`, '#네이버블로그', '#GEO', '#AI포스팅'],
		canonicalUrl: origin.endsWith('/') ? origin : `${origin}/`,
		status: 'draft',
		createdAt: new Date().toISOString(),
		hasGeoFaq: true,
	};
}

function readRecent(): RecentProjectChip[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(RECENT_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as RecentProjectChip[];
		return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
	} catch {
		return [];
	}
}

function writeRecent(chips: RecentProjectChip[]) {
	try {
		window.localStorage.setItem(RECENT_KEY, JSON.stringify(chips.slice(0, 5)));
	} catch {
		// ignore quota
	}
}

function normalizeDraft(raw: Partial<BlogDraft> & { id?: string }): BlogDraft | null {
	if (!raw?.id || !raw.title) return null;
	return {
		id: raw.id,
		projectId: raw.projectId || '',
		projectName: raw.projectName || '미지정 프로젝트',
		projectCode: raw.projectCode || raw.projectId || 'project',
		topic: raw.topic || DEFAULT_TREATMENT_TOPICS[0],
		keyword: raw.keyword || '',
		title: raw.title,
		body: raw.body || '',
		faqs: Array.isArray(raw.faqs) ? raw.faqs : [],
		hashtags: Array.isArray(raw.hashtags) ? raw.hashtags : [],
		canonicalUrl: raw.canonicalUrl || '',
		status: raw.status === 'scheduled' || raw.status === 'published' ? raw.status : 'draft',
		createdAt: raw.createdAt || new Date().toISOString(),
		hasGeoFaq: Boolean(raw.hasGeoFaq ?? (raw.faqs && raw.faqs.length > 0)),
	};
}

function readStoredDrafts(): BlogDraft[] | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(DRAFTS_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<BlogDraft>[];
		if (!Array.isArray(parsed) || parsed.length === 0) return null;
		const normalized = parsed.map(normalizeDraft).filter((d): d is BlogDraft => Boolean(d));
		return normalized.length > 0 ? normalized : null;
	} catch {
		return null;
	}
}

function writeDrafts(drafts: BlogDraft[]) {
	try {
		window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
	} catch {
		// ignore
	}
}

export function NaverBlogWorkspace() {
	const [projects, setProjects] = useState<ProjectListItem[]>([]);
	const [projectsLoading, setProjectsLoading] = useState(true);
	const [projectId, setProjectId] = useState<string | null>(null);
	const [topic, setTopic] = useState<string>(DEFAULT_TREATMENT_TOPICS[0]);
	const [keyword, setKeyword] = useState('일본 중입자 치료 비용');
	const [generating, setGenerating] = useState(false);
	const [toast, setToast] = useState<string | null>(null);
	const [recent, setRecent] = useState<RecentProjectChip[]>([]);

	const [drafts, setDrafts] = useState<BlogDraft[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		const stored = readStoredDrafts() ?? seedDrafts();
		setDrafts(stored);
		setActiveId(stored[0]?.id ?? null);
		setRecent(readRecent());
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		writeDrafts(drafts);
	}, [drafts, hydrated]);

	const loadProjects = useCallback(async () => {
		setProjectsLoading(true);
		try {
			const res = await fetch('/api/admin/projects');
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || '프로젝트 목록을 불러오지 못했습니다.');
			const list = (data.projects || []) as ProjectListItem[];
			setProjects(list.length > 0 ? list : FALLBACK_PROJECTS);
			if (!projectId) {
				const first = list[0] || FALLBACK_PROJECTS[0];
				if (first) setProjectId(first.id);
			}
		} catch {
			setProjects(FALLBACK_PROJECTS);
			if (!projectId) setProjectId(FALLBACK_PROJECTS[0]?.id ?? null);
		} finally {
			setProjectsLoading(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only bootstrap once
	}, []);

	useEffect(() => {
		void loadProjects();
	}, [loadProjects]);

	const selectedProject = useMemo(
		() => projects.find((p) => p.id === projectId) ?? null,
		[projects, projectId],
	);

	const topics = useMemo(() => getTopicsForProject(selectedProject), [selectedProject]);
	const keywordChips = useMemo(() => getKeywordSuggestions(topic), [topic]);
	const recentUsable = useMemo(
		() => recent.filter((r) => projects.some((p) => p.id === r.id)).slice(0, 5),
		[recent, projects],
	);

	useEffect(() => {
		if (!topics.includes(topic)) {
			setTopic(topics[0] || DEFAULT_TREATMENT_TOPICS[0]);
		}
	}, [topics, topic]);

	const active = useMemo(
		() => drafts.find((d) => d.id === activeId) ?? null,
		[drafts, activeId],
	);

	const kpi = useMemo(() => {
		const draftCount = drafts.filter((d) => d.status === 'draft').length;
		const scheduledCount = drafts.filter((d) => d.status === 'scheduled').length;
		const publishedCount = drafts.filter((d) => d.status === 'published').length;
		return { total: drafts.length, draftCount, scheduledCount, publishedCount };
	}, [drafts]);

	function showToast(message: string) {
		setToast(message);
		window.setTimeout(() => setToast(null), 2600);
	}

	function pushRecent(project: ProjectListItem) {
		const chip: RecentProjectChip = {
			id: project.id,
			code: extractProjectCode(project),
			name: project.name,
		};
		setRecent((prev) => {
			const next = [chip, ...prev.filter((r) => r.id !== chip.id)].slice(0, 5);
			writeRecent(next);
			return next;
		});
	}

	function selectProject(id: string) {
		setProjectId(id);
		const project = projects.find((p) => p.id === id);
		if (project) pushRecent(project);
	}

	function updateActive(patch: Partial<BlogDraft>) {
		if (!activeId) return;
		setDrafts((prev) => prev.map((d) => (d.id === activeId ? { ...d, ...patch } : d)));
	}

	function updateFaq(faqId: string, patch: Partial<FaqItem>) {
		if (!active) return;
		const faqs = active.faqs.map((f) => (f.id === faqId ? { ...f, ...patch } : f));
		updateActive({ faqs, hasGeoFaq: faqs.length > 0 });
	}

	function addFaq() {
		if (!active) return;
		const next: FaqItem = {
			id: crypto.randomUUID(),
			question: '새 질문을 입력하세요',
			answer: '답변을 입력하세요',
		};
		updateActive({ faqs: [...active.faqs, next], hasGeoFaq: true });
	}

	function removeFaq(faqId: string) {
		if (!active) return;
		const faqs = active.faqs.filter((f) => f.id !== faqId);
		updateActive({ faqs, hasGeoFaq: faqs.length > 0 });
	}

	async function handleGenerate(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedProject) {
			showToast('프로젝트를 선택해 주세요.');
			return;
		}
		if (!keyword.trim()) {
			showToast('타겟 검색 키워드를 입력해 주세요.');
			return;
		}

		setGenerating(true);
		pushRecent(selectedProject);
		await new Promise((r) => window.setTimeout(r, 700));
		const created = buildGeneratedDraft({
			project: selectedProject,
			topic,
			keyword,
		});
		setDrafts((prev) => [created, ...prev]);
		setActiveId(created.id);
		setGenerating(false);
		showToast('AI 원고 및 GEO FAQ 초안이 생성되었습니다.');
	}

	function handleSave() {
		if (!active) return;
		updateActive({
			hasGeoFaq: active.faqs.length > 0,
			hashtags: active.hashtags.map((t) => t.trim()).filter(Boolean),
		});
		showToast('원고가 저장되었습니다.');
	}

	function handlePublishNow() {
		if (!active) return;
		updateActive({ status: 'published' });
		showToast('네이버 블로그 즉시 발행 요청이 준비되었습니다. (연동 예정)');
	}

	function handleSchedule() {
		if (!active) return;
		updateActive({ status: 'scheduled' });
		showToast('발행 예약 상태가 반영되었습니다. (연동 예정)');
	}

	function handleDelete(id: string) {
		setDrafts((prev) => {
			const remaining = prev.filter((d) => d.id !== id);
			if (activeId === id) setActiveId(remaining[0]?.id ?? null);
			return remaining;
		});
		showToast('원고가 삭제되었습니다.');
	}

	return (
		<div className="flex flex-col gap-5">
			{toast ? (
				<div
					role="status"
					className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-slate-200 bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg"
				>
					{toast}
				</div>
			) : null}

			<section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
				<div>
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
						해결 워크스페이스 · 콘텐츠
					</p>
					<p className="mt-0.5 text-sm text-slate-600">
						대규모 클라이언트 프로젝트를 검색·선택한 뒤 네이버 블로그 원고와 GEO FAQ를 생성합니다.
					</p>
				</div>
				<div className="flex flex-wrap gap-3">
					{[
						{ label: '전체 원고', value: String(kpi.total) },
						{ label: '초안', value: String(kpi.draftCount) },
						{ label: '예약', value: String(kpi.scheduledCount) },
						{ label: '발행완료', value: String(kpi.publishedCount) },
					].map((s) => (
						<div
							key={s.label}
							className="min-w-[72px] rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-center"
						>
							<em className="block text-[10px] font-semibold not-italic text-slate-500">
								{s.label}
							</em>
							<strong className="text-lg font-extrabold tabular-nums text-slate-900">
								{s.value}
							</strong>
						</div>
					))}
				</div>
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
					<div>
						<h2 className="text-base font-bold text-slate-900">포스팅 생성 설정</h2>
						<p className="text-sm text-slate-500">
							사이트 검색 → 치료법/주제 → 타겟 키워드 순으로 설정한 뒤 AI 원고를 생성합니다.
						</p>
					</div>
					<span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
						등록 {projects.length}곳
					</span>
				</div>

				<form onSubmit={(e) => void handleGenerate(e)} className="flex flex-col gap-4">
					{recentUsable.length > 0 ? (
						<div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4">
							<div className="mb-2 text-xs font-semibold text-slate-500">
								📌 최근 작업 프로젝트
							</div>
							<div className="flex flex-wrap gap-2">
								{recentUsable.map((chip) => {
									const active = chip.id === projectId;
									return (
										<button
											key={chip.id}
											type="button"
											onClick={() => selectProject(chip.id)}
											className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ring-1 transition-colors ${
												active
													? 'bg-slate-900 text-white ring-slate-900'
													: 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-100'
											}`}
											title={chip.name}
										>
											[{chip.code}] {chip.name}
										</button>
									);
								})}
							</div>
						</div>
					) : null}

					<div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
						<div>
							<ProjectSearchSelect
								projects={projects}
								value={projectId}
								onChange={selectProject}
								loading={projectsLoading}
							/>
							{selectedProject ? (
								<p className="mt-1.5 truncate text-[11px] text-slate-500">
									대표 URL · {selectedProject.targetUrl}
								</p>
							) : null}
						</div>

						<label className="flex flex-col gap-1.5">
							<span className="text-xs font-semibold text-slate-600">주요 치료법 / 주제</span>
							<select
								value={topic}
								onChange={(e) => setTopic(e.target.value)}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
							>
								{topics.map((t) => (
									<option key={t} value={t}>
										{t}
									</option>
								))}
							</select>
						</label>

						<div className="flex flex-col gap-1.5">
							<label className="flex flex-col gap-1.5">
								<span className="text-xs font-semibold text-slate-600">타겟 검색 키워드</span>
								<input
									value={keyword}
									onChange={(e) => setKeyword(e.target.value)}
									placeholder="예: 일본 중입자 치료 비용"
									className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
								/>
							</label>
							{keywordChips.length > 0 ? (
								<div className="mt-0.5 flex flex-wrap gap-1">
									{keywordChips.map((chip) => (
										<button
											key={chip}
											type="button"
											onClick={() => setKeyword(chip)}
											className={`rounded-md px-2 py-1 text-[11px] font-semibold ring-1 transition-colors ${
												keyword === chip
													? 'bg-slate-900 text-white ring-slate-900'
													: 'bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100'
											}`}
										>
											{chip}
										</button>
									))}
								</div>
							) : null}
						</div>
					</div>

					<div>
						<button
							type="submit"
							disabled={generating || !selectedProject}
							className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
						>
							{generating ? '생성 중…' : '🤖 AI 원고 및 GEO FAQ 자동 생성'}
						</button>
					</div>
				</form>
			</section>

			<section className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
					<div>
						<h2 className="text-base font-bold text-slate-900">생성 원고 미리보기 & 편집기</h2>
						<p className="text-sm text-slate-500">
							제목·본문·GEO FAQ·해시태그·대표 링크를 검토한 뒤 저장하거나 발행합니다.
						</p>
					</div>
				</div>

				{!active ? (
					<div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
						선택된 원고가 없습니다. 상단에서 AI 원고를 생성하거나 아래 목록에서 항목을 선택하세요.
					</div>
				) : (
					<div className="grid w-full grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
						{/* 좌측: 제목 + Toast UI Editor + 태그 + 링크 (자연 높이가 그리드 기준) */}
						<div className="flex min-w-0 w-full flex-col gap-4 lg:col-span-7 xl:col-span-8">
							<label className="flex flex-col gap-1.5">
								<span className="text-xs font-semibold text-slate-600">AI 생성 제목</span>
								<input
									value={active.title}
									onChange={(e) => updateActive({ title: e.target.value })}
									className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
								/>
							</label>

							<MarkdownBodyEditor
								key={active.id}
								value={active.body}
								onChange={(body) => updateActive({ body })}
							/>

							<label className="flex flex-col gap-1.5">
								<span className="text-xs font-semibold text-slate-600">추천 해시태그</span>
								<input
									value={active.hashtags.join(' ')}
									onChange={(e) =>
										updateActive({
											hashtags: e.target.value
												.split(/\s+/)
												.map((t) => t.trim())
												.filter(Boolean),
										})
									}
								placeholder="#중입자치료 #일본암치료"
								className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
								/>
								<div className="flex flex-wrap gap-1.5">
									{active.hashtags.map((tag) => (
										<span
											key={tag}
											className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700"
										>
											{tag.startsWith('#') ? tag : `#${tag}`}
										</span>
									))}
								</div>
							</label>

							<label className="flex flex-col gap-1.5">
								<span className="text-xs font-semibold text-slate-600">대표 링크 미리보기</span>
								<input
									value={active.canonicalUrl}
									onChange={(e) => updateActive({ canonicalUrl: e.target.value })}
									placeholder="https://example.com/treatment"
									className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
								/>
								{active.canonicalUrl ? (
									<a
										href={active.canonicalUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="truncate text-[12px] font-medium text-sky-700 hover:underline"
									>
										↗ {active.canonicalUrl}
									</a>
								) : null}
							</label>
						</div>

						{/* 우측: GEO FAQ (남는 세로 공간을 채워 좌측 본문 에디터 바닥선까지 확장) + 발행 액션 */}
						<aside className="mt-0 flex h-full w-full min-h-0 min-w-0 flex-col justify-between pt-0 lg:col-span-5 xl:col-span-4">
							{/* 좌측 제목 Input 상단 라인 기준에서 30px 추가로 위로 올림 */}
							<div className="-mt-[30px] mb-4 flex flex-col">
								{/*
								  좌측 라벨(text-xs/leading-4) + gap-1.5 만큼 상단 오프셋(정렬 기준선).
								  위 -mt-[30px]로 전체 FAQ 영역을 그 기준선보다 30px 더 위로 이동.
								  아래 faq-list-container는 높이를 좌측 에디터(600px)에 맞춰 고정하고,
								  FAQ 개수가 늘어나면 박스 내부에서만 세로 스크롤되도록 한다.
								*/}
								<div className="mb-1.5 h-4 shrink-0" aria-hidden />

								<div className="mb-2 flex items-center justify-between gap-2">
									<h3 className="text-base font-bold text-slate-900">GEO용 FAQ (Q&A)</h3>
									<button
										type="button"
										onClick={addFaq}
										className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
									>
										+ FAQ 추가
									</button>
								</div>

								{/* 높이 고정 + 넘치면 내부 스크롤 */}
								<div className="faq-list-container max-h-[600px] space-y-2 overflow-y-auto pr-1">
									{active.faqs.length === 0 ? (
										<p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
											FAQ가 없습니다. GEO 인용률을 위해 Q&A를 추가하세요.
										</p>
									) : (
										active.faqs.map((faq, idx) => (
											<article
												key={faq.id}
												className="faq-card w-full shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5"
											>
												<div className="mb-1 flex items-center justify-between gap-2">
													<span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
														Q{idx + 1}
													</span>
													<button
														type="button"
														onClick={() => removeFaq(faq.id)}
														className="shrink-0 text-[11px] font-semibold text-rose-600 hover:text-rose-700"
													>
														삭제
													</button>
												</div>
												<input
													value={faq.question}
													onChange={(e) => updateFaq(faq.id, { question: e.target.value })}
													className="mb-1.5 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
												/>
												<textarea
													value={faq.answer}
													onChange={(e) => updateFaq(faq.id, { answer: e.target.value })}
													rows={3}
													className="w-full min-w-0 resize-y rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs leading-snug text-slate-700"
												/>
											</article>
										))
									)}
								</div>
							</div>

							{/* 좌측 대표 링크 하단 라인에 바닥 밀착 */}
							<div className="action-sidebar shrink-0 space-y-2 border-t border-slate-100 pt-3">
								<div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
									<span
										className={`rounded-md px-2 py-0.5 font-bold ring-1 ${STATUS_STYLE[active.status]}`}
									>
										{STATUS_LABEL[active.status]}
									</span>
									<span>
										생성 {formatDate(active.createdAt)} ·{' '}
										{active.hasGeoFaq ? 'GEO FAQ 포함' : 'GEO FAQ 없음'}
									</span>
								</div>
								<button
									type="button"
									onClick={handleSave}
									className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
								>
									원고 저장
								</button>
								<button
									type="button"
									onClick={handlePublishNow}
									className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
								>
									네이버 블로그 즉시 발행
								</button>
								<button
									type="button"
									onClick={handleSchedule}
									className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-100"
								>
									발행 예약
								</button>
							</div>
						</aside>
					</div>
				)}
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
					<div>
						<h2 className="text-base font-bold text-slate-900">포스팅 생성 이력</h2>
						<p className="text-sm text-slate-500">
							프로젝트·키워드·발행 상태를 확인하고 보기/삭제로 관리합니다.
						</p>
					</div>
					<span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200">
						{drafts.length}건
					</span>
				</div>

				<div className="overflow-x-auto rounded-lg border border-slate-200">
					<table className="min-w-full border-collapse text-left text-sm">
						<thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-3 py-2.5">프로젝트명</th>
								<th className="px-3 py-2.5">타겟 키워드</th>
								<th className="px-3 py-2.5">제목</th>
								<th className="px-3 py-2.5">FAQ</th>
								<th className="px-3 py-2.5">발행 상태</th>
								<th className="px-3 py-2.5">생성일</th>
								<th className="px-3 py-2.5 text-right">관리</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{drafts.length === 0 ? (
								<tr>
									<td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
										등록된 원고가 없습니다.
									</td>
								</tr>
							) : (
								drafts.map((row) => {
									const selected = row.id === activeId;
									return (
										<tr
											key={row.id}
											className={selected ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/80'}
										>
											<td className="px-3 py-3">
												<div className="font-medium text-slate-800">{row.projectName}</div>
												<div className="font-mono text-[10px] text-slate-400">
													[{row.projectCode}]
												</div>
											</td>
											<td className="px-3 py-3 text-slate-600">{row.keyword}</td>
											<td className="max-w-[240px] px-3 py-3">
												<span className="line-clamp-2 font-semibold text-slate-900">
													{row.title}
												</span>
											</td>
											<td className="px-3 py-3">
												{row.hasGeoFaq ? (
													<span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
														포함
													</span>
												) : (
													<span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
														없음
													</span>
												)}
											</td>
											<td className="px-3 py-3">
												<span
													className={`rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${STATUS_STYLE[row.status]}`}
												>
													{STATUS_LABEL[row.status]}
												</span>
											</td>
											<td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
												{formatDate(row.createdAt)}
											</td>
											<td className="px-3 py-3">
												<div className="flex justify-end gap-1.5">
													<button
														type="button"
														onClick={() => setActiveId(row.id)}
														className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
													>
														보기
													</button>
													<button
														type="button"
														onClick={() => handleDelete(row.id)}
														className="rounded border border-rose-200 bg-white px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
													>
														삭제
													</button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}
