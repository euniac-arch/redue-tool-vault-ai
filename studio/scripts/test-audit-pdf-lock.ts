/**
 * Guest PDF / share lock stays in sync between the floating bar and in-report CTA.
 * Run: npx tsx scripts/test-audit-pdf-lock.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isAuditMemberSignedIn } from '../lib/audit/use-audit-member-gate';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

function read(rel: string) {
	return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

assert('guest session is locked', isAuditMemberSignedIn(null) === false);
assert('empty user is locked', isAuditMemberSignedIn({ user: null }) === false);
assert('signed-in user is unlocked', isAuditMemberSignedIn({ user: { id: 'u1' } }) === true);

const hook = read('lib/audit/use-audit-member-gate.ts');
assert('shared hook opens the auth modal', hook.includes('setAuthModalOpen(true)') && hook.includes('requireMember'));

const header = read('components/audit/GeoScoreOverviewHeader.tsx');
assert('in-report PDF uses the shared gate', header.includes('useAuditMemberGate'));
assert('in-report PDF blocks download for guests', header.includes('requireMember(tAuth(\'exportMessage\'))'));
assert('in-report PDF uses a reserved lock slot', header.includes('MiniLockSlot'));

const bar = read('components/AuditShareBar.tsx');
assert('floating bar uses the same gate', bar.includes('useAuditMemberGate'));
assert('floating exports use the same exportMessage', bar.includes('requireMember(tAuth(\'exportMessage\'))'));
assert('email preview CTA is removed from the floating bar', !bar.includes('onOpenEmail') && !bar.includes('t(\'email\')'));
assert('copy and kakao are guest-locked', bar.includes('locked={!signedIn}') && bar.includes('onLockedClick'));
assert('floating lock is a corner badge', bar.includes('MemberLockBadge') && !bar.includes('MiniLockSlot'));
assert('geo/aeo guide sits below kakao share', bar.indexOf('handleShare()') < bar.indexOf("t('geoAeoGuide')"));
assert('geo/aeo guide modal is wired', bar.includes('GeoAeoWorkGuideModal'));

const guideModal = read('components/audit/GeoAeoWorkGuideModal.tsx');
assert('guide modal uses isolated wrap and #geoGuideModal', guideModal.includes('id="geoGuideModal"') && guideModal.includes('geo-guide-modal-wrap'));
assert('guide checklist updates progress ids', guideModal.includes('progressFill') && guideModal.includes('progressText') && guideModal.includes('check-item'));
assert('guide modal defaults to dark theme with toggle', guideModal.includes('data-theme={theme}') && guideModal.includes('theme-switch-group') && guideModal.includes("geoGuideTheme"));

const link = read('components/audit/ReportShareLinkButton.tsx');
assert('share link button honors locked clicks', link.includes('onLockedClick') && link.includes('MemberLockBadge'));
assert('share link lock is not inline', !link.includes('MiniLockSlot'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\n정합성 검증 완료: 플로팅 액션 레이어 정리 및 비회원 잠금 동기화');
console.log('all assertions passed');
