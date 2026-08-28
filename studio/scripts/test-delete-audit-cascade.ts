import { normalizeAuditDeleteUrl } from '../lib/audit/delete-audit-cascade';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(msg);
}

assert(
	normalizeAuditDeleteUrl('https://Admentor.co.kr/') === 'https://admentor.co.kr/',
	'host lowercased, trailing slash kept as /',
);
assert(
	normalizeAuditDeleteUrl('https://admentor.co.kr/about/') === 'https://admentor.co.kr/about',
	'path trailing slash stripped',
);
assert(
	normalizeAuditDeleteUrl('https://admentor.co.kr/#top') === 'https://admentor.co.kr/',
	'hash stripped',
);
assert(normalizeAuditDeleteUrl('  not-a-url  ') === 'not-a-url', 'invalid URL trimmed');

console.log('OK delete-audit-cascade normalize');
