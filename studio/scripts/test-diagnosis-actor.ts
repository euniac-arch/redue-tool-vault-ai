import assert from 'node:assert/strict';
import {
	resolveDiagnosisActor,
	normalizeDiagnosisUserType,
	resolveStoredDiagnosisUserType,
} from '../lib/audit/diagnosis-actor';

assert.equal(normalizeDiagnosisUserType('ADMIN'), 'admin');
assert.equal(normalizeDiagnosisUserType('User'), 'user');
assert.equal(normalizeDiagnosisUserType(''), 'guest');

const adminFromSession = resolveDiagnosisActor({
	sessionUserId: 'admin-master-id',
	sessionEmail: 'admin',
	sessionRole: 'ADMIN',
});
assert.equal(adminFromSession.userType, 'admin');
assert.equal(adminFromSession.userId, 'admin-master-id');

const adminFromQuotaDev = resolveDiagnosisActor({
	sessionUserId: 'admin-master-id',
	sessionRole: 'ADMIN',
	quotaUserId: 'admin-master-id',
	quotaRole: 'admin',
});
assert.equal(adminFromQuotaDev.userType, 'admin');

const guestNoSession = resolveDiagnosisActor({
	hintedUserId: 'spoof-admin',
	hintedRole: 'admin',
});
assert.equal(guestNoSession.userType, 'guest');
assert.equal(guestNoSession.userId, null);

const member = resolveDiagnosisActor({
	sessionUserId: 'user-1',
	sessionRole: 'USER',
});
assert.equal(member.userType, 'user');

assert.equal(resolveStoredDiagnosisUserType({ userType: 'admin', userId: 'admin-master-id' }), 'admin');
assert.equal(resolveStoredDiagnosisUserType({ userType: 'user', userId: 'user-1' }), 'user');
assert.equal(resolveStoredDiagnosisUserType({ userType: 'guest' }), 'guest');
assert.equal(resolveStoredDiagnosisUserType({ userType: 'guest', userId: 'user-1' }), 'user');
assert.equal(
	resolveStoredDiagnosisUserType({ userType: 'guest', userId: 'admin-master-id', role: 'ADMIN' }),
	'admin',
);
assert.equal(resolveStoredDiagnosisUserType({ userType: 'USER', userId: null }), 'user');

console.log('test-diagnosis-actor: ok');
