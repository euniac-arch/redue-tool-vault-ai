import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	query,
	serverTimestamp,
	where,
} from 'firebase/firestore';
import { getClientFirestore, isFirebaseClientConfigured } from '@/lib/firebase/client';
import { createdAtToIso } from '@/lib/firebase/audit-projects-types';
import { formatInquiryDate, toUserInquiryStatus, type WorkInquiry } from '@/lib/mypage/work-inquiries';
import type { ResearchScrap } from '@/lib/mypage/research-scraps';

export const INQUIRIES_COLLECTION = 'inquiries';
export const RESEARCH_SCRAPS_COLLECTION = 'research_scraps';

export type InquiryCreateInput = {
	userId: string;
	serviceType: string;
	title: string;
	content: string;
	contactPhone?: string;
};

export type ScrapCreateInput = {
	userId: string;
	queryKeyword: string;
	articleTitle: string;
	source: string;
	articleUrl: string;
	aiSummary: string;
	tag: string;
};

export type SaveResearchScrapResult = {
	scrap: ResearchScrap;
	duplicate: boolean;
};

function requireFirestore() {
	if (!isFirebaseClientConfigured()) {
		throw new Error('Firebase가 설정되어 있지 않습니다. NEXT_PUBLIC_FIREBASE_API_KEY와 PROJECT_ID를 확인해 주세요.');
	}
	return getClientFirestore();
}

function asTrimmed(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function displayDate(value: unknown): string {
	if (!value) return formatInquiryDate(new Date().toISOString());
	return formatInquiryDate(createdAtToIso(value));
}

function normalizeArticleUrl(url: string): string {
	const raw = url.trim();
	try {
		const parsed = new URL(raw);
		parsed.hash = '';
		return parsed.toString().replace(/\/$/, '');
	} catch {
		return raw.replace(/\/$/, '');
	}
}

export function mapInquiryDoc(id: string, data: Record<string, unknown>): WorkInquiry | null {
	const title = asTrimmed(data.title);
	const content = asTrimmed(data.content);
	if (!id || (!title && !content)) return null;
	const status = toUserInquiryStatus(data.status);
	const createdIso = createdAtToIso(data.createdAt);
	return {
		id,
		serviceType: asTrimmed(data.serviceType) || '기타 작업 의뢰',
		title: title || content.slice(0, 48) || '작업 문의',
		createdAt: displayDate(data.createdAt),
		createdAtIso: createdIso,
		status,
		content: content || title,
		adminReply: asTrimmed(data.adminReply) || null,
		repliedAt: data.repliedAt ? (asTrimmed(data.repliedAt) || displayDate(data.repliedAt)) : null,
		contactPhone: asTrimmed(data.contactPhone),
		pageUrl: asTrimmed(data.pageUrl) || asTrimmed(data.url) || null,
		inquiryType: asTrimmed(data.inquiryType) || undefined,
	};
}

export function mapScrapDoc(id: string, data: Record<string, unknown>): ResearchScrap | null {
	const articleTitle = asTrimmed(data.articleTitle);
	const articleUrl = asTrimmed(data.articleUrl);
	if (!id || !articleTitle || !articleUrl) return null;
	return {
		id,
		queryKeyword: asTrimmed(data.queryKeyword) || articleTitle,
		articleTitle,
		source: asTrimmed(data.source) || 'News',
		articleUrl,
		aiSummary: asTrimmed(data.aiSummary) || '저장된 인사이트 기사입니다.',
		scrappedAt: displayDate(data.createdAt),
		tag: asTrimmed(data.tag) || 'AI / SEO',
	};
}

function sortByCreatedAtDesc<T extends { createdAt?: unknown; scrappedAt?: string }>(
	rows: Array<{ createdAt?: unknown; data: T; iso: string }>,
): T[] {
	return rows
		.sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0))
		.map((row) => row.data);
}

export async function fetchInquiries(userId: string): Promise<WorkInquiry[]> {
	const uid = userId.trim();
	if (!uid) return [];
	const db = requireFirestore();
	const snap = await getDocs(query(collection(db, INQUIRIES_COLLECTION), where('userId', '==', uid)));
	const mapped = snap.docs
		.map((item) => {
			const data = item.data() as Record<string, unknown>;
			const inquiry = mapInquiryDoc(item.id, data);
			return inquiry ? { data: inquiry, iso: createdAtToIso(data.createdAt) } : null;
		})
		.filter((item): item is { data: WorkInquiry; iso: string } => Boolean(item));
	return sortByCreatedAtDesc(mapped);
}

export async function createInquiry(inquiryData: InquiryCreateInput): Promise<WorkInquiry> {
	const userId = inquiryData.userId.trim();
	const title = inquiryData.title.trim();
	const content = inquiryData.content.trim();
	if (!userId || !title || !content) {
		throw new Error('문의 제목과 내용을 입력해 주세요.');
	}
	const db = requireFirestore();
	const payload = {
		userId,
		serviceType: inquiryData.serviceType.trim() || '기타 작업 의뢰',
		title,
		content,
		contactPhone: inquiryData.contactPhone?.trim() || '',
		status: 'pending' as const,
		adminReply: null,
		repliedAt: null,
		createdAt: serverTimestamp(),
	};
	const ref = await addDoc(collection(db, INQUIRIES_COLLECTION), payload);
	return {
		id: ref.id,
		serviceType: payload.serviceType,
		title,
		content,
		createdAt: formatInquiryDate(new Date().toISOString()),
		status: 'pending',
		adminReply: null,
		repliedAt: null,
		contactPhone: payload.contactPhone,
	};
}

export async function fetchScraps(userId: string): Promise<ResearchScrap[]> {
	const uid = userId.trim();
	if (!uid) return [];
	const db = requireFirestore();
	const snap = await getDocs(query(collection(db, RESEARCH_SCRAPS_COLLECTION), where('userId', '==', uid)));
	const mapped = snap.docs
		.map((item) => {
			const data = item.data() as Record<string, unknown>;
			const scrap = mapScrapDoc(item.id, data);
			return scrap ? { data: scrap, iso: createdAtToIso(data.createdAt) } : null;
		})
		.filter((item): item is { data: ResearchScrap; iso: string } => Boolean(item));
	return sortByCreatedAtDesc(mapped);
}

export async function saveResearchScrap(scrapData: ScrapCreateInput): Promise<SaveResearchScrapResult> {
	const userId = scrapData.userId.trim();
	const articleUrl = scrapData.articleUrl.trim();
	const articleTitle = scrapData.articleTitle.trim();
	if (!userId || !articleUrl || !articleTitle) {
		throw new Error('저장할 기사 정보가 부족합니다.');
	}
	const existing = await fetchScraps(userId);
	const normalized = normalizeArticleUrl(articleUrl);
	const duplicate = existing.find((item) => normalizeArticleUrl(item.articleUrl) === normalized);
	if (duplicate) {
		return { scrap: duplicate, duplicate: true };
	}

	const db = requireFirestore();
	const payload = {
		userId,
		queryKeyword: scrapData.queryKeyword.trim() || articleTitle,
		articleTitle,
		source: scrapData.source.trim() || 'News',
		articleUrl,
		aiSummary: scrapData.aiSummary.trim() || '저장된 인사이트 기사입니다.',
		tag: scrapData.tag.trim() || 'AI / SEO',
		createdAt: serverTimestamp(),
	};
	const ref = await addDoc(collection(db, RESEARCH_SCRAPS_COLLECTION), payload);
	return {
		duplicate: false,
		scrap: {
			id: ref.id,
			queryKeyword: payload.queryKeyword,
			articleTitle,
			source: payload.source,
			articleUrl,
			aiSummary: payload.aiSummary,
			scrappedAt: formatInquiryDate(new Date().toISOString()),
			tag: payload.tag,
		},
	};
}

export async function deleteResearchScrap(scrapId: string): Promise<void> {
	const id = scrapId.trim();
	if (!id) throw new Error('삭제할 스크랩이 없습니다.');
	const db = requireFirestore();
	await deleteDoc(doc(db, RESEARCH_SCRAPS_COLLECTION, id));
}
