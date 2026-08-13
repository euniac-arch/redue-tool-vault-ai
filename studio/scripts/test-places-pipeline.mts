import {
	phoneIdentityKey,
	phoneLookupVariants,
} from '../lib/crawling/contact-info';
import {
	buildPlacesTextQuery,
	clampPlacesNeededCount,
	isPlaceWebsiteEligible,
	mapGooglePlaceToRecord,
} from '../lib/crawling/places';

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function main() {
	assert(buildPlacesTextQuery('부산', '화장품') === '부산 화장품', 'query compose');
	assert(buildPlacesTextQuery('부산', '부산 화장품') === '부산 화장품', 'query no dup metro');
	assert(buildPlacesTextQuery('', '화장품') === '화장품', 'query keyword only');
	assert(clampPlacesNeededCount(999) === 60, 'clamp max');
	assert(clampPlacesNeededCount(0) === 1, 'clamp min');

	const mapped = mapGooglePlaceToRecord(
		{
			place_id: 'ChIJtest',
			name: '테스트화장품',
			formatted_address: '부산 해운대구 1',
			rating: 4.5,
			user_ratings_total: 120,
		},
		{
			place_id: 'ChIJtest',
			name: '테스트화장품',
			formatted_address: '부산 해운대구 1',
			formatted_phone_number: '051-123-4567',
			website: 'www.example-beauty.co.kr',
			rating: 4.6,
			user_ratings_total: 130,
		},
	);
	assert(mapped, 'map record');
	assert(mapped.name === '테스트화장품', 'name');
	assert(mapped.formatted_phone_number === '051-123-4567', 'phone');
	assert(mapped.website === 'https://www.example-beauty.co.kr', 'website protocol');
	assert(mapped.rating === 4.6, 'details rating wins');
	assert(mapped.user_ratings_total === 130, 'review count');

	assert(isPlaceWebsiteEligible(mapped.website) === true, 'eligible shop site');
	assert(isPlaceWebsiteEligible(null) === false, 'no website');
	assert(isPlaceWebsiteEligible('https://www.instagram.com/shop') === false, 'sns skip');
	assert(isPlaceWebsiteEligible('https://map.naver.com/p/entry') === false, 'portal skip');

	assert(phoneIdentityKey('051-123-4567') === '0511234567', 'phone key dashed');
	assert(phoneIdentityKey('+82 51-123-4567') === '0511234567', 'phone key intl');
	assert(phoneLookupVariants('051-123-4567').includes('0511234567'), 'lookup variants');

	const noWebsite = mapGooglePlaceToRecord(
		{ place_id: 'x', name: '전화만' },
		{ formatted_phone_number: '010-1111-2222' },
	);
	assert(noWebsite?.website === null, 'missing website stays null');
	assert(isPlaceWebsiteEligible(noWebsite?.website) === false, 'filter no website');

	console.log('places pipeline helper tests passed');
}

main();
