import { ApiSettingsDashboard } from '@/components/admin/api-settings/ApiSettingsDashboard';

export const dynamic = 'force-dynamic';

export default function AdminApiSettingsPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
					System Integrations
				</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					API Key &amp; Firebase 연동 설정
				</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					Firebase, Gemini/OpenAI, 카카오·구글 소셜 로그인 키를 한 화면에서 관리하고 연결을 시험합니다.
				</p>
			</div>
			<ApiSettingsDashboard />
		</main>
	);
}
