'use client';

import { History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AuditHistoryModal } from '@/components/guide/AuditHistoryModal';
import { GuideReportTemplate } from '@/components/guide/GuideReportTemplate';
import { emptyChannelBriefing, emptySubScores } from '@/lib/analysis/evaluateAiBottlenecks';
import { generateSmartHashtags, normalizeHashtagList, stripHashtagPrefix } from '@/lib/analysis/generateSmartHashtags';
import { ensureGuideData } from '@/lib/guide/ensure-guide-data';
import { guideDataFromHistoryRow } from '@/lib/guide/from-audit';
import type { GuideHistoryRow } from '@/lib/guide/history-picker';
import { copyGuideShareUrl, guideSharePath, printGuideReport } from '@/lib/guide/print';
import { emptyGuideData, NINEONE_GUIDE_SAMPLE } from '@/lib/guide/sample';
import { createGuideId, suggestGuideSlug } from '@/lib/guide/slug';
import { loadGuideDraft, saveGuide, saveGuideDraft } from '@/lib/guide/storage';
import { isUsableNapMatrix } from '@/lib/audit/nap-matrix';
import type { AuditReport } from '@/lib/site-auditor';
import type {
	AiEngineDiagnosis,
	ChannelBadgeType,
	ChannelStatusBriefing,
	GuideAiEngineStatus,
	GuideData,
	GuideSocialLinks,
	SubScores,
} from '@/lib/guide/types';
import { GUIDE_AUDIT_SNAPSHOT_KEY, GUIDE_SEO_MAX_DEFAULT } from '@/lib/guide/types';

type AdminTab = 'form' | 'preview';

function joinTags(values: string[]): string {
	return values.join(', ');
}

function splitTags(raw: string): string[] {
	return raw
		.split(/[,#\n]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function withIdentity(data: Partial<GuideData>, slugTouched: boolean): GuideData {
	const resolved = ensureGuideData(data);
	if (slugTouched) {
		return { ...resolved, slug: (data.slug || resolved.slug || '').trim().toLowerCase() };
	}
	return {
		...resolved,
		slug: suggestGuideSlug(resolved.brandNameEng, resolved.brandName, resolved.slug),
	};
}

export function GuideAdminWorkspace() {
	const [data, setData] = useState<GuideData>(() => withIdentity(emptyGuideData(), false));
	const [slugTouched, setSlugTouched] = useState(false);
	const [coreFeaturesText, setCoreFeaturesText] = useState('');
	const [tab, setTab] = useState<AdminTab>('form');
	const [copied, setCopied] = useState(false);
	const [status, setStatus] = useState('');
	const [hydrated, setHydrated] = useState(false);
	const [auditSnapshot, setAuditSnapshot] = useState<GuideData | null>(null);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [selectingHistoryId, setSelectingHistoryId] = useState<string | null>(null);

	useEffect(() => {
		const draft = loadGuideDraft();
		if (draft) {
			applyGuide(draft, Boolean(draft.slug));
		} else {
			applyGuide({ ...emptyGuideData(), id: createGuideId(), createdAt: new Date().toISOString() }, false);
		}
		setAuditSnapshot(readAuditSnapshot());
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		const timer = window.setTimeout(() => {
			saveGuideDraft(data);
			if (data.slug.trim()) saveGuide(data);
		}, 280);
		return () => window.clearTimeout(timer);
	}, [data, hydrated]);

	function applyGuide(next: GuideData, touched: boolean) {
		const resolved = withIdentity(next, touched);
		setSlugTouched(touched);
		setData(resolved);
		setCoreFeaturesText(joinTags(resolved.coreFeatures));
	}

	function patch<K extends keyof GuideData>(key: K, value: GuideData[K]) {
		setData((prev) => {
			const next = { ...prev, [key]: value };
			if (!slugTouched && (key === 'brandName' || key === 'brandNameEng')) {
				next.slug = suggestGuideSlug(
					key === 'brandNameEng' ? String(value) : next.brandNameEng,
					key === 'brandName' ? String(value) : next.brandName,
				);
			}
			if (key === 'brandName' || key === 'brandNameEng' || key === 'address' || key === 'telephone' || key === 'socialLinks') {
				return ensureGuideData({ ...next, napMatrix: undefined });
			}
			return next;
		});
	}

	function patchSocial(key: keyof GuideSocialLinks, value: string) {
		setData((prev) =>
			ensureGuideData({
				...prev,
				socialLinks: { ...prev.socialLinks, [key]: value },
				napMatrix: undefined,
			}),
		);
	}

	function patchDiagnosis(engine: AiEngineDiagnosis['engine'], next: Partial<AiEngineDiagnosis>) {
		setData((prev) => ({
			...prev,
			aiEngineDiagnoses: prev.aiEngineDiagnoses.map((row) =>
				row.engine === engine ? { ...row, ...next } : row,
			),
		}));
	}

	function patchSubScore(key: keyof SubScores, value: number) {
		setData((prev) => ({
			...prev,
			subScores: { ...emptySubScores(), ...prev.subScores, [key]: value },
		}));
	}

	function patchChannel(key: keyof ChannelStatusBriefing, next: Partial<ChannelStatusBriefing[typeof key]>) {
		setData((prev) => {
			const fallback = emptyChannelBriefing();
			return {
				...prev,
				channelBriefing: {
					...fallback,
					...prev.channelBriefing,
					[key]: { ...fallback[key], ...prev.channelBriefing?.[key], ...next },
				},
			};
		});
	}

	function rebuildSmartHashtags(source: GuideData): string[] {
		return generateSmartHashtags({
			brandName: source.brandName,
			region: source.region,
			industry: source.industry,
			address: source.address,
			coreFeatures: source.coreFeatures,
		}).map(stripHashtagPrefix);
	}

	function handleRegenerateHashtags() {
		const tags = rebuildSmartHashtags({ ...data, coreFeatures: splitTags(coreFeaturesText) });
		patch('keywords', tags);
		setStatus(`스마트 해시태그 ${tags.length}개를 생성했습니다.`);
	}

	function rememberSnapshot(source: GuideData) {
		const cloned = cloneGuide(source);
		setAuditSnapshot(cloned);
		writeAuditSnapshot(cloned);
	}

	function handleSelectHistory(row: GuideHistoryRow) {
		setSelectingHistoryId(row.id);
		void (async () => {
			try {
				let fromAudit = guideDataFromHistoryRow(row);
				// Prefer the hydrated server report (napMatrix synthesis) when history rows are stale.
				if (row.id && !isUsableNapMatrix(fromAudit.napMatrix)) {
					try {
						const res = await fetch(`/api/audit/${encodeURIComponent(row.id)}`, { cache: 'no-store' });
						if (res.ok) {
							const payload = (await res.json()) as { report?: AuditReport };
							if (payload?.report?.url) {
								fromAudit = guideDataFromHistoryRow({
									...row,
									hasReport: true,
									entry: { ...row.entry, report: payload.report },
								});
							}
						}
					} catch {
						/* keep local mapping */
					}
				}
				applyGuide(fromAudit, Boolean(fromAudit.slug));
				rememberSnapshot(fromAudit);
				setHistoryOpen(false);
				setStatus(
					`${fromAudit.brandName || row.brandName} 진단을 불러왔습니다 — SEO ${fromAudit.observedSeoScore}/${fromAudit.seoMaxScore || GUIDE_SEO_MAX_DEFAULT}, AI TRUST ${fromAudit.aiTrustScore}. 추천 해시태그 ${fromAudit.keywords.length}개.`,
				);
			} catch (error) {
				console.error('[guide] select history failed', error);
				applyGuide(
					ensureGuideData({
						brandName: row.brandName,
						socialLinks: { website: row.url },
						observedSeoScore: row.seoScore,
						seoMaxScore: row.seoMaxScore,
						aiTrustScore: row.aiTrustScore,
					}),
					Boolean(row.brandName),
				);
				setHistoryOpen(false);
				setStatus('선택한 진단의 일부 필드가 비어 기본값으로 미리보기를 열었습니다.');
			} finally {
				setSelectingHistoryId(null);
			}
		})();
	}

	function handleRestoreAudit() {
		if (!auditSnapshot) {
			setStatus('복원할 원본 진단값이 없습니다. 먼저 [진단 목록에서 선택]으로 이력을 불러오세요.');
			return;
		}
		applyGuide(cloneGuide(auditSnapshot), Boolean(auditSnapshot.slug));
		setStatus('원래 진단값으로 복원했습니다. 이후 수정분은 미리보기에서 다시 덮어쓸 수 있습니다.');
	}

	function handleReset() {
		applyGuide({ ...emptyGuideData(), id: createGuideId(), createdAt: new Date().toISOString() }, false);
		setAuditSnapshot(null);
		writeAuditSnapshot(null);
		setStatus('입력값을 초기화했습니다.');
	}

	function handleSample() {
		const sample = { ...NINEONE_GUIDE_SAMPLE, createdAt: new Date().toISOString() };
		applyGuide(sample, true);
		rememberSnapshot(sample);
		setStatus('나인원의원 샘플 가이드를 불러왔습니다.');
	}

	async function handleCopy() {
		if (!data.slug.trim()) {
			setStatus('슬러그를 입력한 뒤 링크를 복사하세요.');
			return;
		}
		saveGuide(data);
		const ok = await copyGuideShareUrl(data.slug);
		setCopied(ok);
		setStatus(ok ? `공유 링크를 복사했습니다: ${guideSharePath(data.slug)}` : '클립보드 복사에 실패했습니다.');
		window.setTimeout(() => setCopied(false), 2200);
	}

	function handlePrint() {
		if (data.slug.trim()) saveGuide(data);
		// The report pane is only mounted-visible via `xl:block` below the desktop
		// breakpoint; browsers evaluate that media query against the print page box
		// (not the on-screen window), so it can stay hidden and print a blank page.
		// Forcing the 'preview' tab removes the `hidden` class outright, independent
		// of any print media-query quirk.
		setTab('preview');
		printGuideReport();
	}

	const previewData = useMemo(() => data, [data]);

	return (
		<div className="flex flex-col gap-4">
			<div className="guide-no-print flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Client deliverable</p>
						<h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">맞춤형 AI/SEO 실행 가이드 생성기</h2>
						<p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-300">
							[진단 목록에서 선택]으로 과거 진단 업체를 고르면 SEO 실측·AI TRUST·5대 지표·6대 엔진 처방·해시태그가 폼에
							주입됩니다. 문구는 인라인으로 Override 할 수 있고, [원래 진단값으로 복원]으로 불러온 원본을 다시 적용하세요.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<button type="button" onClick={() => setHistoryOpen(true)} className={ghostBtn}>
							<span className="inline-flex items-center gap-1.5">
								<History className="h-4 w-4" aria-hidden />
								진단 목록에서 선택
							</span>
						</button>
						<button type="button" onClick={handleSample} className={ghostBtn}>
							샘플(나인원) 데이터 로드
						</button>
						<button type="button" onClick={handleRestoreAudit} className={ghostBtn} disabled={!auditSnapshot}>
							원래 진단값으로 복원
						</button>
						<button type="button" onClick={handleReset} className={ghostBtn}>
							초기화
						</button>
						<button type="button" onClick={handleCopy} className={ghostBtn}>
							{copied ? '링크 복사됨' : '웹 링크 복사'}
						</button>
						<button type="button" onClick={handlePrint} className={primaryBtn}>
							PDF 인쇄/저장
						</button>
					</div>
				</div>
				{status ? <p className="text-sm text-slate-600 dark:text-slate-300">{status}</p> : null}
				<div className="flex gap-2 lg:hidden">
					{(
						[
							['form', '입력 폼'],
							['preview', '실시간 미리보기'],
						] as const
					).map(([id, label]) => (
						<button
							key={id}
							type="button"
							onClick={() => setTab(id)}
							className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
								tab === id
									? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
									: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
							}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			<div className="guide-report-shell grid min-h-0 gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
				<form
					className={`guide-no-print space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 ${
						tab === 'preview' ? 'hidden xl:block' : ''
					}`}
					onSubmit={(event) => event.preventDefault()}
				>
					<fieldset className="space-y-3">
						<legend className="text-sm font-bold text-slate-900 dark:text-slate-100">기본 정보</legend>
						<Field label="상호명(국문)" value={data.brandName} onChange={(v) => patch('brandName', v)} />
						<Field label="영문명" value={data.brandNameEng} onChange={(v) => patch('brandNameEng', v)} />
						<Field
							label="슬러그 (URL)"
							value={data.slug}
							onChange={(v) => {
								setSlugTouched(true);
								patch('slug', v.toLowerCase().replace(/[^a-z0-9-]/g, ''));
							}}
							hint={data.slug ? `공유 경로: ${guideSharePath(data.slug)}` : '영문/숫자/하이픈만 사용'}
						/>
						<Field label="업종/전문 분야" value={data.industry} onChange={(v) => patch('industry', v)} />
						<Field label="지역/상권" value={data.region} onChange={(v) => patch('region', v)} placeholder="예: 대구 동구" />
						<Field label="상세 주소" value={data.address} onChange={(v) => patch('address', v)} placeholder="도로명 주소" />
						<Field
							label="대표 전화번호"
							value={data.telephone || ''}
							onChange={(v) => patch('telephone', v)}
							placeholder="미등록 시 비워 두면 리포트에 '미등록'으로 표시"
						/>
					</fieldset>

					<fieldset className="space-y-3">
						<legend className="text-sm font-bold text-slate-900 dark:text-slate-100">핵심 특장점 · 타깃 키워드</legend>
						<Field
							label="핵심 특장점 (쉼표 구분)"
							value={coreFeaturesText}
							onChange={(v) => {
								setCoreFeaturesText(v);
								patch('coreFeatures', splitTags(v));
							}}
							placeholder="예: 핵심 시술/서비스명을 쉼표로 구분해 입력"
						/>
						<HashtagChipInput
							tags={data.keywords}
							onChange={(tags) => patch('keywords', tags)}
							onRegenerate={handleRegenerateHashtags}
						/>
					</fieldset>

					<fieldset className="space-y-3">
						<legend className="text-sm font-bold text-slate-900 dark:text-slate-100">SNS · 웹사이트</legend>
						<Field label="Website" value={data.socialLinks.website || ''} onChange={(v) => patchSocial('website', v)} />
						<Field label="YouTube" value={data.socialLinks.youtube || ''} onChange={(v) => patchSocial('youtube', v)} />
						<Field label="Instagram" value={data.socialLinks.instagram || ''} onChange={(v) => patchSocial('instagram', v)} />
						<Field label="Facebook" value={data.socialLinks.facebook || ''} onChange={(v) => patchSocial('facebook', v)} />
						<Field label="Blog" value={data.socialLinks.blog || ''} onChange={(v) => patchSocial('blog', v)} />
					</fieldset>

					<fieldset className="space-y-3">
						<legend className="text-sm font-bold text-slate-900 dark:text-slate-100">AI 인용 Q&A</legend>
						<Field label="질문" value={data.faq.question} onChange={(v) => patch('faq', { ...data.faq, question: v })} />
						<label className="block">
							<span className="mb-1 block text-xs font-semibold text-slate-500">답변</span>
							<textarea
								value={data.faq.answer}
								onChange={(event) => patch('faq', { ...data.faq, answer: event.target.value })}
								rows={4}
								className={inputClass}
							/>
						</label>
					</fieldset>

					<details className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40" open>
						<summary className="cursor-pointer list-none text-sm font-bold text-slate-900 dark:text-slate-100">
							점수 & 현주소 브리핑
						</summary>
						<div className="mt-3 space-y-4 pb-2">
							<div className="grid grid-cols-2 gap-2">
								<NumberField
									label="SEO 실측 점수"
									value={data.observedSeoScore}
									onChange={(v) => patch('observedSeoScore', v)}
								/>
								<NumberField
									label="SEO 만점"
									value={data.seoMaxScore ?? GUIDE_SEO_MAX_DEFAULT}
									onChange={(v) => patch('seoMaxScore', v)}
								/>
								<NumberField
									label="AI TRUST (100)"
									value={data.aiTrustScore}
									max={100}
									onChange={(v) => patch('aiTrustScore', v)}
								/>
								<NumberField
									label="AI 잠재력 (100)"
									value={data.aiPotentialScore}
									max={100}
									onChange={(v) => patch('aiPotentialScore', v)}
								/>
							</div>
							<div className="grid grid-cols-2 gap-2">
								<NumberField label="전문성" value={data.subScores.specialty} max={100} onChange={(v) => patchSubScore('specialty', v)} />
								<NumberField label="지역성" value={data.subScores.localPresence} max={100} onChange={(v) => patchSubScore('localPresence', v)} />
								<NumberField label="신뢰도" value={data.subScores.authority} max={100} onChange={(v) => patchSubScore('authority', v)} />
								<NumberField label="차별성" value={data.subScores.uniqueness} max={100} onChange={(v) => patchSubScore('uniqueness', v)} />
								<NumberField label="인지도" value={data.subScores.awareness} max={100} onChange={(v) => patchSubScore('awareness', v)} />
							</div>
							<ChannelEditor
								label="생성형 AI 검색 (GEO)"
								item={data.channelBriefing.aiSearch}
								onChange={(next) => patchChannel('aiSearch', next)}
							/>
							<ChannelEditor
								label="구글 검색 & GBP"
								item={data.channelBriefing.googleSearch}
								onChange={(next) => patchChannel('googleSearch', next)}
							/>
							<ChannelEditor
								label="네이버 스마트플레이스"
								item={data.channelBriefing.naverPlace}
								onChange={(next) => patchChannel('naverPlace', next)}
							/>
						</div>
					</details>

					<details className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40" open>
						<summary className="cursor-pointer list-none text-sm font-bold text-slate-900 dark:text-slate-100">
							6대 AI 엔진 분석
						</summary>
						<div className="mt-3 space-y-2 pb-1">
							<p className="text-[11px] text-slate-500">
								진단 불러오기 후 생성된 문구를 아코디언에서 즉시 Override 하면 우측 미리보기에 반영됩니다.
							</p>
							{(data.aiEngineDiagnoses || []).map((row) => (
								<AiDiagnosisEditor key={row.engine} row={row} onChange={(next) => patchDiagnosis(row.engine, next)} />
							))}
						</div>
					</details>
				</form>

				<div
					className={`guide-report-pane min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 ${tab === 'form' ? 'hidden xl:block' : ''}`}
				>
					<div className="guide-no-print border-b border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
						실시간 미리보기 · 인쇄 시 이 리포트만 A4로 출력됩니다
					</div>
					<div className="guide-preview-scroll max-h-[78vh] overflow-auto xl:max-h-[calc(100dvh-220px)]">
						{previewData ? <GuideReportTemplate data={ensureGuideData(previewData)} /> : null}
					</div>
				</div>
			</div>
			<AuditHistoryModal
				open={historyOpen}
				onClose={() => setHistoryOpen(false)}
				onSelect={handleSelectHistory}
				selectingId={selectingHistoryId}
			/>
		</div>
	);
}

function AiDiagnosisEditor({
	row,
	onChange,
}: {
	row: AiEngineDiagnosis;
	onChange: (next: Partial<AiEngineDiagnosis>) => void;
}) {
	const tone =
		row.status === 'OPTIMAL'
			? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
			: row.status === 'CRITICAL'
				? 'border-rose-200 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/30'
				: 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30';

	return (
		<details className={`rounded-lg border px-3 py-2 ${tone}`} open={row.status !== 'OPTIMAL'}>
			<summary className="cursor-pointer list-none text-sm font-semibold text-slate-800 dark:text-slate-100">
				<span className="mr-2 text-xs font-extrabold tracking-wide text-slate-500">{row.status}</span>
				{row.engineName}
				<span className="ml-2 text-[11px] font-medium text-slate-500">{row.statusText}</span>
			</summary>
			<div className="mt-3 space-y-2 pb-1">
				<p className="text-[11px] text-slate-500">{row.category}</p>
				<label className="block">
					<span className="mb-1 block text-xs font-semibold text-slate-500">상태</span>
					<select
						value={row.status}
						onChange={(event) => onChange({ status: event.target.value as GuideAiEngineStatus })}
						className={inputClass}
					>
						<option value="OPTIMAL">OPTIMAL — 신호 최적화 완료</option>
						<option value="WARNING">WARNING — 신호 약화</option>
						<option value="CRITICAL">CRITICAL — 응답 누락</option>
					</select>
				</label>
				<Field label="상태 문구" value={row.statusText} onChange={(v) => onChange({ statusText: v })} />
				<label className="block">
					<span className="mb-1 block text-xs font-semibold text-slate-500">감지된 원인 (Override)</span>
					<textarea
						value={row.detectedCause}
						onChange={(event) => onChange({ detectedCause: event.target.value })}
						rows={3}
						className={inputClass}
					/>
				</label>
				<label className="block">
					<span className="mb-1 block text-xs font-semibold text-slate-500">조치 항목 (줄바꿈 구분)</span>
					<textarea
						value={row.actionItems.join('\n')}
						onChange={(event) =>
							onChange({
								actionItems: event.target.value
									.split('\n')
									.map((line) => line.trim())
									.filter(Boolean),
							})
						}
						rows={4}
						className={inputClass}
					/>
				</label>
			</div>
		</details>
	);
}

function NumberField({
	label,
	value,
	onChange,
	max = 200,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
	max?: number;
}) {
	return (
		<label className="block">
			<span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
			<input
				type="number"
				min={0}
				max={max}
				value={Number.isFinite(value) ? value : 0}
				onChange={(event) => onChange(Math.min(max, Math.max(0, Number(event.target.value) || 0)))}
				className={inputClass}
			/>
		</label>
	);
}

function ChannelEditor({
	label,
	item,
	onChange,
}: {
	label: string;
	item: ChannelStatusBriefing['aiSearch'];
	onChange: (next: Partial<ChannelStatusBriefing['aiSearch']>) => void;
}) {
	return (
		<div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
			<p className="text-xs font-bold text-slate-700 dark:text-slate-200">{label}</p>
			<Field label="상태 배지" value={item.statusBadge} onChange={(v) => onChange({ statusBadge: v })} />
			<label className="block">
				<span className="mb-1 block text-xs font-semibold text-slate-500">배지 색상</span>
				<select
					value={item.badgeType}
					onChange={(event) => onChange({ badgeType: event.target.value as ChannelBadgeType })}
					className={inputClass}
				>
					<option value="amber">amber — 주의</option>
					<option value="green">green — 양호</option>
					<option value="blue">blue — 확장</option>
				</select>
			</label>
			<label className="block">
				<span className="mb-1 block text-xs font-semibold text-slate-500">브리핑 문구</span>
				<textarea
					value={item.description}
					onChange={(event) => onChange({ description: event.target.value })}
					rows={4}
					className={inputClass}
				/>
			</label>
		</div>
	);
}

function cloneGuide(data: GuideData): GuideData {
	return JSON.parse(JSON.stringify(data)) as GuideData;
}

function readAuditSnapshot(): GuideData | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.sessionStorage.getItem(GUIDE_AUDIT_SNAPSHOT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as GuideData;
		return parsed?.slug != null ? parsed : null;
	} catch {
		return null;
	}
}

function writeAuditSnapshot(data: GuideData | null) {
	if (typeof window === 'undefined') return;
	try {
		if (!data) {
			window.sessionStorage.removeItem(GUIDE_AUDIT_SNAPSHOT_KEY);
			return;
		}
		window.sessionStorage.setItem(GUIDE_AUDIT_SNAPSHOT_KEY, JSON.stringify(data));
	} catch {
		// ignore
	}
}

function HashtagChipInput({
	tags,
	onChange,
	onRegenerate,
}: {
	tags: string[];
	onChange: (tags: string[]) => void;
	onRegenerate: () => void;
}) {
	const [draft, setDraft] = useState('');

	function commitDraft() {
		const next = stripHashtagPrefix(draft);
		if (!next) {
			setDraft('');
			return;
		}
		onChange(normalizeHashtagList([...tags, next], false));
		setDraft('');
	}

	return (
		<div>
			<div className="mb-1 flex items-center justify-between gap-2">
				<span className="text-xs font-semibold text-slate-500">타깃 해시태그 (최대 10개)</span>
				<button type="button" onClick={onRegenerate} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
					스마트 태그 다시 생성
				</button>
			</div>
			<div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900">
				{tags.map((tag) => {
					const label = stripHashtagPrefix(tag);
					return (
						<span
							key={label}
							className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
						>
							#{label}
							<button
								type="button"
								aria-label={`${label} 삭제`}
								onClick={() => onChange(tags.filter((item) => stripHashtagPrefix(item) !== label))}
								className="rounded-full px-0.5 text-sky-500 hover:text-rose-600"
							>
								×
							</button>
						</span>
					);
				})}
				<input
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === ',') {
							event.preventDefault();
							commitDraft();
						}
						if (event.key === 'Backspace' && !draft && tags.length) {
							onChange(tags.slice(0, -1));
						}
					}}
					onBlur={commitDraft}
					placeholder={tags.length ? '추가 후 Enter' : '예: 대구피부과'}
					className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
				/>
			</div>
			<span className="mt-1 block text-[11px] text-slate-400">진단 데이터 또는 스마트 생성으로 채운 뒤, 칩의 ×로 삭제하거나 직접 추가하세요.</span>
		</div>
	);
}

function Field({
	label,
	value,
	onChange,
	placeholder,
	hint,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	hint?: string;
}) {
	return (
		<label className="block">
			<span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				className={inputClass}
			/>
			{hint ? <span className="mt-1 block text-[11px] text-slate-400">{hint}</span> : null}
		</label>
	);
}

const inputClass =
	'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-900/10 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const ghostBtn =
	'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-700';

const primaryBtn =
	'rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950';
