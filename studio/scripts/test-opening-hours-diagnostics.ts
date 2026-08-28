/**
 * openingHoursSpecification schema analyzer — @graph traversal, dayOfWeek
 * normalization, and weekday/night-hours coverage scoring.
 * Run: npx tsx scripts/test-opening-hours-diagnostics.ts
 */
import { evaluateSchemaFiveProperties, normalizeDayOfWeek } from '../lib/audit/extractors/universal-entity';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

// —— dayOfWeek normalization ——
assert(
	'single string day',
	JSON.stringify(normalizeDayOfWeek('Monday')) === JSON.stringify(['Monday']),
);
assert(
	'array of days',
	JSON.stringify(normalizeDayOfWeek(['Monday', 'Tuesday'])) === JSON.stringify(['Monday', 'Tuesday']),
);
assert(
	'schema.org URI day',
	JSON.stringify(normalizeDayOfWeek('https://schema.org/Friday')) === JSON.stringify(['Friday']),
);
assert(
	'openingHours shorthand single day',
	JSON.stringify(normalizeDayOfWeek('Mo 09:30-18:30')) === JSON.stringify(['Monday']),
);
assert(
	'openingHours shorthand range',
	JSON.stringify(normalizeDayOfWeek('Mo-Fr 09:00-18:00')) ===
		JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
);
assert('empty/undefined day yields no entries', normalizeDayOfWeek(undefined).length === 0);

// —— @graph traversal: OpeningHoursSpecification nested under a MedicalClinic/Physician node ——
const graphLd = JSON.stringify({
	'@context': 'https://schema.org',
	'@graph': [
		{ '@type': 'WebSite', name: 'Clinic Site' },
		{
			'@type': ['MedicalClinic', 'Physician'],
			name: '레듀클리닉',
			openingHoursSpecification: [
				{
					'@type': 'OpeningHoursSpecification',
					dayOfWeek: ['https://schema.org/Monday', 'https://schema.org/Tuesday', 'https://schema.org/Wednesday', 'https://schema.org/Thursday'],
					opens: '09:00',
					closes: '20:30',
				},
				{
					'@type': 'OpeningHoursSpecification',
					dayOfWeek: 'Saturday',
					opens: '09:00',
					closes: '13:00',
				},
			],
		},
	],
});
const graphResult = evaluateSchemaFiveProperties(graphLd, { schemaTypes: ['MedicalClinic'] });
assert('graph: openingHours complete', graphResult.openingHours.complete === true, JSON.stringify(graphResult.openingHours));
assert('graph: weekday coverage is 5 (Mon-Thu + Sat)', graphResult.openingHours.weekdayCount === 5, String(graphResult.openingHours.weekdayCount));
assert('graph: night hours pass (closes 20:30)', graphResult.openingHours.nightHoursPass === true);
assert('graph: weekend pass (Saturday present)', graphResult.openingHours.weekendPass === true);

// —— dayOfWeek as single string + closes 19:30 boundary ——
const singleDayLd = JSON.stringify({
	'@type': 'LocalBusiness',
	openingHoursSpecification: {
		'@type': 'OpeningHoursSpecification',
		dayOfWeek: 'Monday',
		opens: '09:00',
		closes: '19:30',
	},
});
const singleDayResult = evaluateSchemaFiveProperties(singleDayLd);
assert('single weekday closes exactly 19:30 counts as night hours', singleDayResult.openingHours.nightHoursPass === true);
assert('single weekday (1/6) fails the weekday pass bar', singleDayResult.openingHours.weekdayPass === false);
assert('single weekday overall not complete (below 4-day bar)', singleDayResult.openingHours.complete === false);

// —— openingHours shorthand string on the entity node itself ——
const shorthandLd = JSON.stringify({
	'@type': 'LocalBusiness',
	openingHours: ['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'],
});
const shorthandResult = evaluateSchemaFiveProperties(shorthandLd);
assert('shorthand openingHours parses weekday coverage (Mon-Fri + Sat = 6)', shorthandResult.openingHours.weekdayCount === 6, String(shorthandResult.openingHours.weekdayCount));
assert('shorthand openingHours is complete', shorthandResult.openingHours.complete === true);
assert('shorthand openingHours has no night hours (closes 18:00)', shorthandResult.openingHours.nightHoursPass === false);

// —— nested under a non-whitelisted key (e.g. `department`) is still discovered ——
const departmentLd = JSON.stringify({
	'@type': 'MedicalClinic',
	department: [
		{
			'@type': 'MedicalClinic',
			name: '야간진료실',
			openingHoursSpecification: [
				{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Friday'], opens: '09:00', closes: '21:00' },
			],
		},
	],
});
const departmentResult = evaluateSchemaFiveProperties(departmentLd);
assert('department-nested spec is discovered', departmentResult.openingHours.parsed === true);
assert('department-nested spec counts weekday coverage', departmentResult.openingHours.weekdayCount === 4, String(departmentResult.openingHours.weekdayCount));
assert('department-nested spec detects night hours (closes 21:00)', departmentResult.openingHours.nightHoursPass === true);

// —— missing entirely ——
const noHoursLd = JSON.stringify({ '@type': 'LocalBusiness', name: 'No Hours Co' });
const noHoursResult = evaluateSchemaFiveProperties(noHoursLd);
assert('no openingHours data at all is not complete', noHoursResult.openingHours.complete === false);
assert('no openingHours data has zero weekday coverage', noHoursResult.openingHours.weekdayCount === 0);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall opening-hours diagnostics assertions passed');
