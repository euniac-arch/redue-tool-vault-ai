import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { DeveloperKeysPanel } from '@/components/DeveloperKeysPanel';

export default async function DeveloperPage() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		redirect('/login?callbackUrl=/developer');
	}

	return (
		<main className="flex flex-col gap-6">
			<section>
				<h1 className="text-2xl font-bold text-white">개발자 API 관리</h1>
				<p className="mt-1 text-sm text-slate-400">
					외부 서비스에서 REDUE AI의 스키마 생성 엔진을 호출할 수 있는 API Key를 발급하고 사용량을 관리하세요.
				</p>
			</section>

			<DeveloperKeysPanel />
		</main>
	);
}
