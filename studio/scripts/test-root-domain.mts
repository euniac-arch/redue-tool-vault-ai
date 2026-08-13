import {
	extractHostname,
	extractRootDomain,
	extractSld,
	isDefaultBlacklistedDomain,
} from '../lib/crawling/domain';

type Case = {
	input: string;
	expected: string | null;
};

const cases: Case[] = [
	{ input: 'https://www.example.co.jp/about?id=1', expected: 'example.co.jp' },
	{ input: 'http://www.example.com/path', expected: 'example.com' },
	{ input: 'https://shop.sub.example.com/a?x=1', expected: 'example.com' },
	{ input: 'https://WWW.Example.CO.KR/foo', expected: 'example.co.kr' },
	{ input: 'example.co.jp', expected: 'example.co.jp' },
	{ input: 'www.clinic.or.kr', expected: 'clinic.or.kr' },
	{ input: 'https://blog.naver.com/user', expected: 'naver.com' },
	{ input: 'https://user:pass@www.example.com:8080/x', expected: 'example.com' },
	{ input: 'https://192.168.1.1/', expected: null },
	{ input: 'localhost', expected: null },
	{ input: '', expected: null },
	{ input: 'https://co.jp/', expected: null },
];

let failed = 0;
for (const { input, expected } of cases) {
	const got = extractRootDomain(input);
	const ok = got === expected;
	if (!ok) {
		failed += 1;
		console.error('FAIL extractRootDomain', { input, expected, got });
	}
}

const blacklistHits = [
	'https://www.amazon.co.jp/dp/1',
	'https://google.com/search',
	'https://en.wikipedia.org/wiki/X',
	'https://yahoo.co.kr/',
	'https://www.youtube.com/watch?v=1',
];
for (const url of blacklistHits) {
	if (!isDefaultBlacklistedDomain(url)) {
		failed += 1;
		console.error('FAIL blacklist should exclude', url, extractRootDomain(url));
	}
}

const allowHits = [
	'https://www.miso-dental.co.kr/',
	'https://bright-eye.example.co.jp/about',
	'https://my-clinic.com/',
];
for (const url of allowHits) {
	if (isDefaultBlacklistedDomain(url)) {
		failed += 1;
		console.error('FAIL blacklist should allow', url, extractRootDomain(url));
	}
}

console.log({
	hostname: extractHostname('https://www.example.co.jp/about?id=1'),
	root: extractRootDomain('https://www.example.co.jp/about?id=1'),
	sld: extractSld('example.co.jp'),
	failed,
});

if (failed > 0) {
	process.exit(1);
}
console.log('extractRootDomain tests passed');
