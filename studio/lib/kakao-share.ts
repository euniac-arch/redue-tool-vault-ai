declare global {
	interface Window {
		Kakao?: {
			isInitialized: () => boolean;
			init: (key: string) => void;
			Share: {
				sendDefault: (options: Record<string, unknown>) => void;
			};
		};
	}
}

const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';

function loadScript(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) {
			resolve();
			return;
		}
		const script = document.createElement('script');
		script.src = src;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error('카카오 SDK 로드에 실패했습니다.'));
		document.head.appendChild(script);
	});
}

export interface ShareContent {
	title: string;
	description: string;
	link: string;
}

/**
 * Shares a REDUE audit report via the Kakao JS SDK feed template. Requires
 * `NEXT_PUBLIC_KAKAO_JS_KEY` (issued at https://developers.kakao.com — free
 * tier). Returns `false` (instead of throwing) when the key isn't configured
 * so callers can fall back to a plain link-copy share.
 */
export async function shareToKakao(content: ShareContent): Promise<boolean> {
	const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
	if (!kakaoKey) return false;

	await loadScript(KAKAO_SDK_URL);
	if (!window.Kakao) return false;
	if (!window.Kakao.isInitialized()) {
		window.Kakao.init(kakaoKey);
	}

	window.Kakao.Share.sendDefault({
		objectType: 'text',
		text: `${content.title}\n${content.description}`,
		link: { mobileWebUrl: content.link, webUrl: content.link },
		buttons: [{ title: '진단 리포트 보기', link: { mobileWebUrl: content.link, webUrl: content.link } }],
	});
	return true;
}
