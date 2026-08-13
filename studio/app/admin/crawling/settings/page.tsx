import { redirect } from 'next/navigation';

/** Legacy path — canonical route is /admin/crawling/setup */
export default function AdminCrawlingSettingsRedirectPage() {
	redirect('/admin/crawling/setup');
}
