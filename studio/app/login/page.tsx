import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

function isSocialOAuthConfigured(): boolean {
	return [
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET,
		process.env.KAKAO_CLIENT_ID,
		process.env.KAKAO_CLIENT_SECRET,
	].every((value) => Boolean(value?.trim()));
}

export default function LoginPage() {
	const showOAuthEnvGuide = process.env.NODE_ENV !== 'production' && !isSocialOAuthConfigured();

	return (
		<Suspense fallback={null}>
			<LoginForm showOAuthEnvGuide={showOAuthEnvGuide} />
		</Suspense>
	);
}
