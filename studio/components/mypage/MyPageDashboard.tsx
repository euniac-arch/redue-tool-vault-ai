'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
	createInquiry,
	deleteResearchScrap,
	fetchInquiries,
	fetchScraps,
} from '@/lib/mypage/firebase-mypage-service';
import { resolveMypageUserId } from '@/lib/mypage/mypage-user-id';
import { AI_SEARCH_DAILY_LIMIT } from '@/lib/insights/insights-ai-usage';
import { resetInsightsLocalData } from '@/lib/insights/insights-local-reset';
import {
	readScrappedNews,
	removeScrappedNews,
	SCRAPPED_NEWS_EVENT,
	scrapToResearchScrap,
} from '@/lib/insights/scrapped-news';
import {
	readScrappedVideos,
	removeScrappedVideo,
	SCRAPPED_VIDEOS_EVENT,
	type ScrappedVideoItem,
} from '@/lib/insights/scrapped-videos';
import { filterResearchScraps, mergeResearchScraps, type ResearchScrap } from '@/lib/mypage/research-scraps';
import {
	WORK_INQUIRY_SERVICE_TYPES,
	WORK_INQUIRY_STATUS,
	type WorkInquiry,
	type WorkInquiryServiceType,
} from '@/lib/mypage/work-inquiries';

export type MyPageDashboardTab = 'inquiries' | 'scraps';

interface MyPageDashboardProps {
	userId?: string;
	userName: string;
	userEmail: string;
	activeTab: MyPageDashboardTab;
	onTabChange: (tab: MyPageDashboardTab) => void;
}

type NewInquiryForm = {
	serviceType: WorkInquiryServiceType;
	title: string;
	content: string;
	contactPhone: string;
};

const EMPTY_FORM: NewInquiryForm = {
	serviceType: 'SEO & GEO 최적화',
	title: '',
	content: '',
	contactPhone: '',
};

export function MyPageDashboard({
	userId,
	userName,
	userEmail,
	activeTab,
	onTabChange,
}: MyPageDashboardProps) {
	const [inquiries, setInquiries] = useState<WorkInquiry[]>([]);
	const [scraps, setScraps] = useState<ResearchScrap[]>([]);
	const [videos, setVideos] = useState<ScrappedVideoItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [selectedInquiry, setSelectedInquiry] = useState<WorkInquiry | null>(null);
	const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
	const [newInquiry, setNewInquiry] = useState<NewInquiryForm>(EMPTY_FORM);
	const [scrapSearch, setScrapSearch] = useState('');
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [deletingScrapId, setDeletingScrapId] = useState<string | null>(null);

	const initial = userName.trim().charAt(0).toUpperCase() || 'M';
	const uid = resolveMypageUserId(userId);
	const remoteScrapsRef = useRef<ResearchScrap[]>([]);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setLoadError(null);

		function localScraps(): ResearchScrap[] {
			return readScrappedNews().map(scrapToResearchScrap);
		}

		function applyScraps(remote: ResearchScrap[] = remoteScrapsRef.current) {
			remoteScrapsRef.current = remote;
			if (!cancelled) setScraps(mergeResearchScraps(localScraps(), remote));
		}

		applyScraps([]);
		Promise.all([fetchInquiries(uid), fetchScraps(uid)])
			.then(([nextInquiries, nextScraps]) => {
				if (cancelled) return;
				setInquiries(nextInquiries);
				applyScraps(nextScraps);
			})
			.catch((error) => {
				if (cancelled) return;
				applyScraps(remoteScrapsRef.current);
				setLoadError(error instanceof Error ? error.message : '마이페이지 데이터를 불러오지 못했습니다.');
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		function refreshLocal() {
			applyScraps(remoteScrapsRef.current);
			if (!cancelled) setVideos(readScrappedVideos());
		}
		if (!cancelled) setVideos(readScrappedVideos());
		window.addEventListener(SCRAPPED_NEWS_EVENT, refreshLocal);
		window.addEventListener(SCRAPPED_VIDEOS_EVENT, refreshLocal);
		window.addEventListener('storage', refreshLocal);
		return () => {
			cancelled = true;
			window.removeEventListener(SCRAPPED_NEWS_EVENT, refreshLocal);
			window.removeEventListener(SCRAPPED_VIDEOS_EVENT, refreshLocal);
			window.removeEventListener('storage', refreshLocal);
		};
	}, [uid]);

	const filteredScraps = useMemo(() => filterResearchScraps(scraps, scrapSearch), [scraps, scrapSearch]);
	const filteredVideos = useMemo(() => {
		const keyword = scrapSearch.trim().toLowerCase();
		if (!keyword) return videos;
		return videos.filter(
			(item) =>
				item.title.toLowerCase().includes(keyword) ||
				item.channelTitle.toLowerCase().includes(keyword) ||
				(item.queryKeyword || '').toLowerCase().includes(keyword),
		);
	}, [videos, scrapSearch]);

	function handleResetInsightsLocal() {
		if (
			!window.confirm(
				`저장된 뉴스(북마크)와 오늘 AI 리서치 사용 횟수를 초기화할까요?\n초기화 후 무료 ${AI_SEARCH_DAILY_LIMIT}회를 다시 사용할 수 있습니다.`,
			)
		) {
			return;
		}
		resetInsightsLocalData();
		setScraps(mergeResearchScraps([], remoteScrapsRef.current));
		setVideos([]);
		window.alert(`초기화 완료. AI 리서치 잔여 ${AI_SEARCH_DAILY_LIMIT}/${AI_SEARCH_DAILY_LIMIT}회`);
	}

	async function handleDeleteScrap(id: string) {
		if (!window.confirm('이 리서치 스크랩을 보관함에서 삭제하시겠습니까?')) return;
		setDeletingScrapId(id);
		try {
			const target = scraps.find((item) => item.id === id);
			removeScrappedNews(id);
			if (target?.articleUrl) removeScrappedNews(target.articleUrl);
			remoteScrapsRef.current = remoteScrapsRef.current.filter(
				(item) => item.id !== id && item.articleUrl !== target?.articleUrl,
			);
			try {
				await deleteResearchScrap(id);
			} catch {
				/* local-only scrap — ignore remote delete */
			}
			setScraps((prev) =>
				prev.filter((item) => item.id !== id && item.articleUrl !== target?.articleUrl),
			);
		} catch (error) {
			window.alert(error instanceof Error ? error.message : '스크랩을 삭제하지 못했습니다.');
		} finally {
			setDeletingScrapId(null);
		}
	}

	async function handleCreateInquiry(event: React.FormEvent) {
		event.preventDefault();
		if (!newInquiry.title.trim() || !newInquiry.content.trim()) return;
		setSubmitting(true);
		setSubmitError(null);
		try {
			const created = await createInquiry({
				userId: uid,
				serviceType: newInquiry.serviceType,
				title: newInquiry.title.trim(),
				content: newInquiry.content.trim(),
				contactPhone: newInquiry.contactPhone.trim(),
			});
			setInquiries((prev) => [created, ...prev]);
			setNewInquiry(EMPTY_FORM);
			setIsWriteModalOpen(false);
		} catch (error) {
			setSubmitError(error instanceof Error ? error.message : '문의를 접수하지 못했습니다.');
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
				<div className="flex items-center gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-sm">
						{initial}
					</div>
					<div>
						<h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">회원 마이페이지</h1>
						<p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
							{userName ? `${userName}님의 ` : ''}1:1 맞춤 작업 의뢰 내역 및 AI 실시간 리서치 보관함을 관리합니다.
							{userEmail ? ` (${userEmail})` : ''}
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => {
						setSubmitError(null);
						setIsWriteModalOpen(true);
					}}
					className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
				>
					+ 새 작업 문의하기
				</button>
			</div>

			<div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
				<button
					type="button"
					onClick={() => onTabChange('inquiries')}
					className={`relative flex items-center gap-2 px-4 pb-3 text-sm font-semibold transition-colors ${
						activeTab === 'inquiries'
							? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
							: 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
					}`}
				>
					<span>1:1 작업 문의 내역</span>
					<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
						{inquiries.length}
					</span>
				</button>
				<button
					type="button"
					onClick={() => onTabChange('scraps')}
					className={`relative flex items-center gap-2 px-4 pb-3 text-sm font-semibold transition-colors ${
						activeTab === 'scraps'
							? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
							: 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
					}`}
				>
					<span>AI 리서치 보관함</span>
					<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
						{scraps.length + videos.length}
					</span>
				</button>
			</div>

			{loadError ? (
				<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
					{loadError}
				</div>
			) : null}

			{activeTab === 'inquiries' && (
				<div className="space-y-4">
					{isLoading ? (
						<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
							문의 내역을 불러오는 중…
						</div>
					) : inquiries.length === 0 ? (
						<div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
							<p className="text-sm text-slate-500">등록된 작업 문의가 없습니다.</p>
							<button
								type="button"
								onClick={() => setIsWriteModalOpen(true)}
								className="mt-3 text-sm font-semibold text-blue-600 hover:underline"
							>
								첫 작업 문의 남기기
							</button>
						</div>
					) : (
						inquiries.map((item) => {
							const status = WORK_INQUIRY_STATUS[item.status] || WORK_INQUIRY_STATUS.pending;
							return (
								<button
									key={item.id}
									type="button"
									onClick={() => setSelectedInquiry(item)}
									className="flex w-full cursor-pointer flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-blue-500/50 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center"
								>
									<div className="flex-1 space-y-1.5">
										<div className="flex flex-wrap items-center gap-2">
											<span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-950 dark:text-blue-300">
												{item.serviceType}
											</span>
											<span className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
												{status.label}
											</span>
											<span className="text-xs text-slate-500">{item.createdAt}</span>
										</div>
										<h3 className="line-clamp-1 text-base font-semibold text-slate-900 transition-colors hover:text-blue-600 dark:text-white">
											{item.title}
										</h3>
										<p className="line-clamp-2 text-xs text-slate-500 sm:text-sm">{item.content}</p>
									</div>
									<div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 dark:border-slate-800 md:justify-end md:border-t-0 md:pt-0">
										{item.adminReply ? (
											<span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
												● 답변 완료
											</span>
										) : (
											<span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800">
												○ 답변 대기
											</span>
										)}
										<span className="text-xs font-medium text-blue-600 md:hidden">상세보기 →</span>
									</div>
								</button>
							);
						})
					)}
				</div>
			)}

			{activeTab === 'scraps' && (
				<div className="space-y-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<input
							type="text"
							value={scrapSearch}
							onChange={(event) => setScrapSearch(event.target.value)}
							placeholder="키워드, 기사 제목, 태그 검색..."
							className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:w-80"
						/>
						<button
							type="button"
							onClick={handleResetInsightsLocal}
							className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
						>
							데이터 리셋 (북마크·AI {AI_SEARCH_DAILY_LIMIT}회)
						</button>
					</div>
					{filteredVideos.length > 0 ? (
						<div className="space-y-3">
							<p className="text-xs font-bold text-slate-500">유튜브 영상 보관함 {filteredVideos.length}건</p>
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								{filteredVideos.map((video) => (
									<div
										key={video.videoId}
										className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
									>
										<a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="block aspect-video bg-slate-950">
											{video.thumbnailUrl ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
											) : null}
										</a>
										<div className="space-y-2 p-4">
											<p className="text-[11px] font-semibold text-red-500">YouTube · {video.channelTitle}</p>
											<a
												href={video.videoUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-cyan-600 dark:text-white"
											>
												{video.title}
											</a>
											<div className="flex items-center justify-between text-xs">
												<a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
													영상 보기 ↗
												</a>
												<button
													type="button"
													onClick={() => {
														removeScrappedVideo(video.videoId);
														setVideos((prev) => prev.filter((item) => item.videoId !== video.videoId));
													}}
													className="font-medium text-red-500 hover:text-red-600"
												>
													삭제
												</button>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					) : null}
					{isLoading ? (
						<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
							보관함을 불러오는 중…
						</div>
					) : filteredScraps.length > 0 ? (
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							{filteredScraps.map((scrap) => (
								<div
									key={scrap.id}
									className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
								>
									<div className="space-y-2">
										<div className="flex items-center justify-between text-xs">
											<span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
												{scrap.tag}
											</span>
											<span className="text-slate-500">{scrap.scrappedAt}</span>
										</div>
										<div className="text-xs font-medium text-blue-600 dark:text-blue-400">
											🔍 검색 키워드: {scrap.queryKeyword}
										</div>
										<h4 className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
											{scrap.articleTitle}
										</h4>
										<div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800/80 dark:bg-slate-950/60">
											<p className="mb-1 text-xs font-semibold text-slate-500">AI 핵심 요약</p>
											<p className="text-xs leading-relaxed text-slate-800 dark:text-slate-300">{scrap.aiSummary}</p>
										</div>
									</div>
									<div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
										<a
											href={scrap.articleUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
										>
											원문 출처 ({scrap.source}) ↗
										</a>
										<button
											type="button"
											onClick={() => void handleDeleteScrap(scrap.id)}
											disabled={deletingScrapId === scrap.id}
											className="font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
										>
											{deletingScrapId === scrap.id ? '삭제 중…' : '삭제'}
										</button>
									</div>
								</div>
							))}
						</div>
					) : filteredVideos.length === 0 ? (
						<div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
							<p className="text-sm text-slate-500">보관된 기사·영상이 없습니다.</p>
							<Link href="/insights?tab=insights" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline">
								인사이트에서 스크랩하기
							</Link>
						</div>
					) : null}
				</div>
			)}

			{selectedInquiry && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
					<button type="button" aria-label="닫기" className="absolute inset-0" onClick={() => setSelectedInquiry(null)} />
					<div className="relative max-h-[90vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
						<div className="flex items-start justify-between">
							<div>
								<span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-950 dark:text-blue-300">
									{selectedInquiry.serviceType}
								</span>
								<h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{selectedInquiry.title}</h3>
								<p className="mt-0.5 text-xs text-slate-500">작성일: {selectedInquiry.createdAt}</p>
							</div>
							<button
								type="button"
								onClick={() => setSelectedInquiry(null)}
								className="px-2 text-lg font-bold text-slate-400 hover:text-slate-600"
							>
								✕
							</button>
						</div>
						<div className="space-y-2">
							<p className="text-xs font-semibold text-slate-500">문의 내용</p>
							<div className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed dark:border-slate-800 dark:bg-slate-950/50">
								{selectedInquiry.content}
							</div>
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
								<span>담당자 검토 및 답변</span>
								{selectedInquiry.repliedAt ? (
									<span className="font-normal text-slate-400">{selectedInquiry.repliedAt}</span>
								) : null}
							</div>
							{selectedInquiry.adminReply ? (
								<div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-relaxed text-slate-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-slate-200">
									{selectedInquiry.adminReply}
								</div>
							) : (
								<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-950/30">
									현재 담당자가 내용을 확인하고 있습니다. 확인 후 유선 또는 본 화면을 통해 안내드립니다.
								</div>
							)}
						</div>
						<div className="flex justify-end">
							<button
								type="button"
								onClick={() => setSelectedInquiry(null)}
								className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
							>
								닫기
							</button>
						</div>
					</div>
				</div>
			)}

			{isWriteModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
					<button type="button" aria-label="닫기" className="absolute inset-0" onClick={() => setIsWriteModalOpen(false)} />
					<div className="relative w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-bold text-slate-900 dark:text-white">1:1 작업 의뢰 / 문의하기</h3>
							<button type="button" onClick={() => setIsWriteModalOpen(false)} className="font-bold text-slate-400 hover:text-slate-600">
								✕
							</button>
						</div>
						<form onSubmit={(event) => void handleCreateInquiry(event)} className="space-y-4 text-sm">
							{submitError ? <p className="text-xs font-semibold text-rose-500">{submitError}</p> : null}
							<div>
								<label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">문의 분야</label>
								<select
									value={newInquiry.serviceType}
									onChange={(event) =>
										setNewInquiry({ ...newInquiry, serviceType: event.target.value as WorkInquiryServiceType })
									}
									className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
								>
									{WORK_INQUIRY_SERVICE_TYPES.map((type) => (
										<option key={type} value={type}>
											{type}
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">연락처 (선택)</label>
								<input
									type="text"
									placeholder="상담을 받으실 전화번호나 이메일"
									value={newInquiry.contactPhone}
									onChange={(event) => setNewInquiry({ ...newInquiry, contactPhone: event.target.value })}
									className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">문의 제목</label>
								<input
									type="text"
									required
									placeholder="예: 웹사이트 SEO 진단 및 스키마 주입 견적 요청"
									value={newInquiry.title}
									onChange={(event) => setNewInquiry({ ...newInquiry, title: event.target.value })}
									className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
									요구사항 및 세부 내용
								</label>
								<textarea
									required
									rows={4}
									placeholder="사이트 URL, 현재 상태, 희망 납기일 등 구체적인 내용을 기재해주시면 더 정확한 상담이 가능합니다."
									value={newInquiry.content}
									onChange={(event) => setNewInquiry({ ...newInquiry, content: event.target.value })}
									className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
								/>
							</div>
							<div className="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onClick={() => setIsWriteModalOpen(false)}
									className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
								>
									취소
								</button>
								<button
									type="submit"
									disabled={submitting}
									className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
								>
									{submitting ? '접수 중…' : '문의 접수하기'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
