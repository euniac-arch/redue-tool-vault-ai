/**
 * Universal GNB/Title/Desc/H1 hydration — never copy raw URL paths.
 * Run: npx tsx scripts/test-page-meta-hydrate.ts
 */
import {
	displayGnbLabel,
	humanizePathLabel,
	hydrateSolvePageMeta,
	looksLikeRawUrlOrPath,
} from '../lib/solve/page-meta-hydrate';
import { pagesFromAuditPaths } from '../lib/solve/dynamic-php-schema';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(looksLikeRawUrlOrPath('/theme/basic/html/about.php'), 'raw theme path');
assert(looksLikeRawUrlOrPath('board.php?bo_table=qa'), 'raw board query');
assert(looksLikeRawUrlOrPath('https://clinic.example/intro.php'), 'raw https');
assert(!looksLikeRawUrlOrPath('보톡스 시술 안내'), 'human title ok');
assert(humanizePathLabel('/about-us.php') === '소개', `about-us → ${humanizePathLabel('/about-us.php')}`);
assert(humanizePathLabel('/board.php?bo_table=qa') === 'Q&A 게시판', 'qa board');
assert(humanizePathLabel('/bbs/board.php?bo_table=notice') === '공지사항', 'notice board');
assert(humanizePathLabel('/theme/basic/html/about.php') === '소개', 'theme about stem');

const dirty = hydrateSolvePageMeta(
	{
		urlPath: '/theme/basic/html/about.php',
		title: '/theme/basic/html/about.php',
		h1: 'index.php',
		description: 'https://clinic.example/theme/basic/html/about.php',
		menu1: 'theme',
		menu2: 'basic',
		section: '/theme/basic/',
	},
	{ siteName: '테스트의원' },
);
assert(dirty.title === '소개', `title ${dirty.title}`);
assert(dirty.h1 === '소개', `h1 ${dirty.h1}`);
assert(!looksLikeRawUrlOrPath(dirty.description), `desc ${dirty.description}`);
assert(/테스트의원/.test(dirty.description || '') && /소개/.test(dirty.description || ''), 'desc uses site+title');
assert(dirty.menu1 !== 'theme' && !looksLikeRawUrlOrPath(dirty.menu1), `menu1 ${dirty.menu1}`);
assert(!looksLikeRawUrlOrPath(dirty.section), `section ${dirty.section}`);
assert(!looksLikeRawUrlOrPath(displayGnbLabel(dirty)), `gnb ${displayGnbLabel(dirty)}`);

const titled = hydrateSolvePageMeta(
	{
		urlPath: '/service.php',
		title: '보톡스 시술 안내 | 테스트의원 공식',
		h1: '보톡스 시술 안내',
		description: '본원 보톡스 시술은 숙련된 의료진이 개인별 맞춤으로 진행합니다.',
		menu1: '진료안내',
		menu2: '보톡스',
	},
	{ siteName: '테스트의원' },
);
assert(titled.title === '보톡스 시술 안내', `stripped title ${titled.title}`);
assert(titled.h1 === '보톡스 시술 안내', 'h1 kept');
assert(!/로그인|회원가입/.test(titled.description || ''), 'desc has no chrome');

const mapped = pagesFromAuditPaths({
	siteName: '테스트의원',
	collectedUrlPaths: ['/', '/theme/hospital/html/about.php', '/bbs/board.php?bo_table=qa', '/index.php'],
	mainTitle: '테스트의원',
	mainDescription: '테스트의원 공식 홈페이지입니다.',
	mainH1: '테스트의원',
	industryType: 'MEDICAL',
	navItems: [
		{ name: '인사말', url: '/theme/hospital/html/about.php', menu1: '병원소개', menu2: '인사말' },
		{ name: 'Q&A', url: '/bbs/board.php?bo_table=qa', menu1: '커뮤니티', menu2: 'Q&A' },
	],
	crawledPages: [
		{
			urlPath: '/theme/hospital/html/about.php',
			title: '인사말 | 테스트의원',
			h1: '인사말',
			description: '원장 인사말입니다. 환자를 먼저 생각합니다.',
		},
	],
});
const about = mapped.find((p) => p.urlPath.includes('about.php'));
const qa = mapped.find((p) => /bo_table=qa/.test(p.urlPath || ''));
assert(about?.title === '인사말', `about title ${about?.title}`);
assert(about?.h1 === '인사말', `about h1 ${about?.h1}`);
assert(about?.menu1 === '병원소개', `about menu1 ${about?.menu1}`);
assert(!looksLikeRawUrlOrPath(about?.title) && !looksLikeRawUrlOrPath(about?.description), 'about no url');
assert(qa?.title && !looksLikeRawUrlOrPath(qa.title), `qa title ${qa?.title}`);
assert(!mapped.some((p) => looksLikeRawUrlOrPath(p.title) || looksLikeRawUrlOrPath(p.h1)), 'no raw title/h1');
assert(!mapped.some((p) => looksLikeRawUrlOrPath(p.description)), 'no raw desc');
assert(!mapped.some((p) => looksLikeRawUrlOrPath(p.menu1) || looksLikeRawUrlOrPath(p.section)), 'no raw gnb');

const dirtyClinic = pagesFromAuditPaths({
	siteName: '나인원의원',
	collectedUrlPaths: [
		'/',
		'/theme/basic/contents/s101.php',
		'/bbs/board.php?bo_table=gallery',
		'/bbs/board.php?bo_table=reply',
		'/bbs/board.php?bo_table=qa',
	],
	mainTitle: 'Nineoneclinic',
	mainDescription: 'Nineoneclinic 공식 안내 페이지',
	mainH1: 'Nineoneclinic',
	industryType: 'MEDICAL',
	navItems: [
		{ name: '병원소개', url: '/theme/basic/contents/s101.php', menu1: '병원소개', menu2: '인사말' },
		{ name: '갤러리', url: '/bbs/board.php?bo_table=gallery', menu1: '커뮤니티', menu2: '갤러리' },
		{ name: '치료후기', url: '/bbs/board.php?bo_table=reply', menu1: '커뮤니티', menu2: '치료후기' },
		{ name: 'Q&A', url: '/bbs/board.php?bo_table=qa', menu1: '커뮤니티', menu2: 'Q&A' },
	],
	crawledPages: [
		{
			urlPath: '/theme/basic/contents/s101.php',
			title: '/theme/basic/contents/s101.php',
			h1: '/theme/basic/contents/s101.php',
			description: 'Nineoneclinic /theme/basic/contents/s101.php — 믿을 수 있는 전문 정보와 맞춤 안내를 확인하세요.',
		},
	],
});
const s101 = dirtyClinic.find((p) => /s101\.php/.test(p.urlPath || ''));
const gallery = dirtyClinic.find((p) => /bo_table=gallery/.test(p.urlPath || ''));
const reply = dirtyClinic.find((p) => /bo_table=reply/.test(p.urlPath || ''));
const home = dirtyClinic.find((p) => p.urlPath === '/');
assert(home?.title === '나인원의원', `home title ${home?.title}`);
assert(s101?.title === '인사말' || s101?.title === '병원소개', `s101 title ${s101?.title}`);
assert(!looksLikeRawUrlOrPath(s101?.title) && !looksLikeRawUrlOrPath(s101?.h1), `s101 raw ${s101?.title}`);
assert(!looksLikeRawUrlOrPath(s101?.description), `s101 desc ${s101?.description}`);
assert(!looksLikeRawUrlOrPath(displayGnbLabel(s101!)), `s101 gnb ${displayGnbLabel(s101!)}`);
assert(gallery?.title && !looksLikeRawUrlOrPath(gallery.title), `gallery ${gallery?.title}`);
assert(reply?.title && !looksLikeRawUrlOrPath(reply.title), `reply ${reply?.title}`);
assert(!dirtyClinic.some((p) => p.urlPath === '/faq' || p.urlPath === '/howto'), 'no virtual faq/howto');

const storedDirty = hydrateSolvePageMeta(
	{
		urlPath: '/theme/basic/contents/s101.php',
		title: '/theme/basic/contents/s101.php',
		h1: '/theme/basic/contents/s101.php',
		description: 'Nineoneclinic /theme/basic/contents/s101.php — 믿을 수 있는 전문 정보와 맞춤 안내를 확인하세요.',
		menu1: 'contents',
		menu2: '/theme/basic/contents/s101.php',
		section: 'contents > /theme/basic/contents/s101.php',
	},
	{
		siteName: '나인원의원',
		navItems: [{ name: '인사말', url: '/theme/basic/contents/s101.php', menu1: '병원소개', menu2: '인사말' }],
	},
);
assert(storedDirty.title === '인사말', `stored title ${storedDirty.title}`);
assert(storedDirty.h1 === '인사말', `stored h1 ${storedDirty.h1}`);
assert(storedDirty.menu1 === '병원소개', `stored menu1 ${storedDirty.menu1}`);
assert(!looksLikeRawUrlOrPath(storedDirty.description), `stored desc ${storedDirty.description}`);
assert(!looksLikeRawUrlOrPath(displayGnbLabel(storedDirty)), `stored gnb ${displayGnbLabel(storedDirty)}`);

console.log('test-page-meta-hydrate: ok');
