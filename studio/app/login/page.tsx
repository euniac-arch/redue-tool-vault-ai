import { Suspense } from 'react';
import { isGoogleOAuthConfigured, isKakaoOAuthConfigured } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
	const kakaoEnabled = isKakaoOAuthConfigured();
	const googleEnabled = isGoogleOAuthConfigured();
	const showOAuthEnvGuide = process.env.NODE_ENV !== 'production' && (!kakaoEnabled || !googleEnabled);

	return (
		<Suspense
			fallback={
				<div className="mx-auto flex min-h-[24rem] max-w-sm items-start py-10">
					<div className="h-8 w-40 rounded bg-slate-800/80" />
				</div>
			}
		>
			<LoginForm kakaoEnabled={kakaoEnabled} googleEnabled={googleEnabled} showOAuthEnvGuide={showOAuthEnvGuide} />
		</Suspense>
	);
}
