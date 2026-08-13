import { PrismaClient } from '@prisma/client';
import {
	excludeTargetSites,
	saveDiscoveredTargets,
	updateTargetSiteStatus,
} from '../lib/crawling/target-sites';

const prisma = new PrismaClient();

const TEST_A = 'https://www.upsert-test-clinic.co.jp/about?id=1';
const TEST_B = 'https://www.amazon.co.jp/dp/1';
const DOMAIN_A = 'upsert-test-clinic.co.jp';

async function cleanup() {
	await prisma.targetSite.deleteMany({ where: { domain: DOMAIN_A } });
}

async function main() {
	await cleanup();

	const first = await saveDiscoveredTargets([TEST_A, TEST_B], {
		keyword: '부산 치과',
		enrichContact: false,
	});
	if (first.inserted.length !== 1 || first.inserted[0].domain !== DOMAIN_A) {
		throw new Error(`expected 1 insert, got ${JSON.stringify(first)}`);
	}
	if (!first.skipped.some((row) => row.reason === 'blacklist' && row.domain === 'amazon.co.jp')) {
		throw new Error(`expected amazon blacklist skip, got ${JSON.stringify(first.skipped)}`);
	}

	const second = await saveDiscoveredTargets(
		['https://shop.upsert-test-clinic.co.jp/x'],
		{ keyword: '사하구 치과', enrichContact: false },
	);
	if (second.inserted.length !== 0) {
		throw new Error(`duplicate must not insert: ${JSON.stringify(second)}`);
	}
	if (second.updated.length !== 1 || second.updated[0].status !== 'PENDING') {
		throw new Error(`pending duplicate should update only: ${JSON.stringify(second)}`);
	}

	const row = await prisma.targetSite.findUnique({ where: { domain: DOMAIN_A } });
	if (!row) throw new Error('row missing');
	const keywords = JSON.parse(row.searchKeywords) as string[];
	if (!keywords.includes('부산 치과') || !keywords.includes('사하구 치과')) {
		throw new Error(`keywords not merged: ${row.searchKeywords}`);
	}
	if (row.status !== 'PENDING') throw new Error(`status mutated: ${row.status}`);

	await updateTargetSiteStatus(DOMAIN_A, 'DIAGNOSED');
	const third = await saveDiscoveredTargets([TEST_A], { keyword: '재검색', enrichContact: false });
	if (third.updated[0]?.reason !== 'diagnosed' || third.inserted.length !== 0) {
		throw new Error(`diagnosed must skip new collection: ${JSON.stringify(third)}`);
	}
	const diagnosed = await prisma.targetSite.findUnique({ where: { domain: DOMAIN_A } });
	if (diagnosed?.status !== 'DIAGNOSED') {
		throw new Error(`diagnosed status overwritten: ${diagnosed?.status}`);
	}

	await excludeTargetSites([TEST_A]);
	const excluded = await prisma.targetSite.findUnique({ where: { domain: DOMAIN_A } });
	if (excluded?.status !== 'EXCLUDED') throw new Error('exclude failed');

	const fourth = await saveDiscoveredTargets([TEST_A], { keyword: '무시', enrichContact: false });
	if (fourth.updated[0]?.reason !== 'excluded' || fourth.inserted.length !== 0) {
		throw new Error(`excluded must skip insert: ${JSON.stringify(fourth)}`);
	}
	const still = await prisma.targetSite.findUnique({ where: { domain: DOMAIN_A } });
	if (still?.status !== 'EXCLUDED') throw new Error('excluded status overwritten');

	await cleanup();

	const PHONE_A = 'https://www.phone-dup-clinic-a.co.kr/';
	const PHONE_B = 'https://www.phone-dup-clinic-b.co.kr/';
	const DOMAIN_PHONE_A = 'phone-dup-clinic-a.co.kr';
	const DOMAIN_PHONE_B = 'phone-dup-clinic-b.co.kr';
	await prisma.targetSite.deleteMany({
		where: { domain: { in: [DOMAIN_PHONE_A, DOMAIN_PHONE_B] } },
	});

	const phoneFirst = await saveDiscoveredTargets(
		[
			{
				url: PHONE_A,
				keyword: '부산 화장품',
				phoneNumber: '051-123-4567',
				googleRating: 4.5,
				googleReviewCount: 88,
			},
		],
		{ enrichContact: false },
	);
	if (phoneFirst.inserted.length !== 1) {
		throw new Error(`phone first insert failed: ${JSON.stringify(phoneFirst)}`);
	}
	const rated = await prisma.targetSite.findUnique({ where: { domain: DOMAIN_PHONE_A } });
	if (rated?.googleRating !== 4.5 || rated?.googleReviewCount !== 88) {
		throw new Error(`google rating not stored: ${JSON.stringify(rated)}`);
	}

	const phoneDup = await saveDiscoveredTargets(
		[
			{
				url: PHONE_B,
				keyword: '부산 화장품',
				phoneNumber: '0511234567',
			},
		],
		{ enrichContact: false },
	);
	if (!phoneDup.skipped.some((row) => row.reason === 'phone_duplicate' && row.domain === DOMAIN_PHONE_B)) {
		throw new Error(`expected phone_duplicate skip, got ${JSON.stringify(phoneDup)}`);
	}
	const leaked = await prisma.targetSite.findUnique({ where: { domain: DOMAIN_PHONE_B } });
	if (leaked) throw new Error('phone duplicate must not insert a second domain');

	await prisma.targetSite.deleteMany({
		where: { domain: { in: [DOMAIN_PHONE_A, DOMAIN_PHONE_B] } },
	});

	console.log('saveDiscoveredTargets upsert tests passed');
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await cleanup().catch(() => undefined);
		await prisma.$disconnect();
	});
