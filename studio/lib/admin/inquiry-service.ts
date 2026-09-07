import { fetchAdminApi } from '@/lib/admin/admin-api';
import type {
	ContactInquiry,
	ContactInquiryStatus,
	InquiryFilterStatus,
	InquiryListResult,
} from '@/lib/admin/inquiry-management';

export class AdminInquiryError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AdminInquiryError';
	}
}

export type FetchAdminInquiriesParams = {
	query: string;
	status: InquiryFilterStatus;
	page: number;
	pageSize: number;
	enabled?: boolean;
};

export async function fetchAdminInquiries(params: FetchAdminInquiriesParams): Promise<InquiryListResult> {
	const search = new URLSearchParams({
		q: params.query,
		status: params.status,
		page: String(params.page),
		pageSize: String(params.pageSize),
	});
	const result = await fetchAdminApi<InquiryListResult>(`/api/admin/inquiries?${search.toString()}`, {
		enabled: params.enabled,
	});
	if (!result.ok) {
		throw new AdminInquiryError(result.message);
	}
	return result.data;
}

export async function updateAdminInquiryStatus(
	id: string,
	status: ContactInquiryStatus,
	enabled = true,
): Promise<ContactInquiry> {
	const result = await fetchAdminApi<{ inquiry: ContactInquiry }>(`/api/admin/inquiries/${encodeURIComponent(id)}`, {
		enabled,
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ status }),
	});
	if (!result.ok) {
		throw new AdminInquiryError(result.message);
	}
	return result.data.inquiry;
}

export async function deleteAdminInquiry(id: string, enabled = true): Promise<void> {
	const result = await fetchAdminApi<{ ok: boolean }>(`/api/admin/inquiries/${encodeURIComponent(id)}`, {
		enabled,
		method: 'DELETE',
	});
	if (!result.ok) {
		throw new AdminInquiryError(result.message);
	}
}
