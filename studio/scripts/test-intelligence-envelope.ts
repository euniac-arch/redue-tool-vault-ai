/**
 * ASI API envelope, operation map, and classified errors.
 * Run: npx tsx scripts/test-intelligence-envelope.ts
 */
import {
	asiErrorEnvelope,
	asiEnvelopeMeta,
	asiSuccessEnvelope,
} from '../lib/ai-search-intelligence/api/envelope';
import {
	AsiServiceError,
	asiSafeErrorMessage,
	classifyAsiThrown,
	classifyHttpStatus,
	httpStatusForAsiError,
} from '../lib/ai-search-intelligence/api/errors';
import { createAsiRequestId, redactAsiSecrets } from '../lib/ai-search-intelligence/api/log';
import { ASI_OPERATIONS, asiOperationToAction, resolveAsiOperation } from '../lib/ai-search-intelligence/api/operations';
import { asiFailCopy, asiLoadMessage } from '../lib/ai-search-intelligence/client/asi-client';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('16 operations', ASI_OPERATIONS.length === 16);
assert('opportunity-finder resolves', resolveAsiOperation('opportunity-finder') === 'opportunity-finder');
assert('opportunity-finder → opportunity action', asiOperationToAction('opportunity-finder') === 'opportunity');
assert('evidence-explorer resolves', resolveAsiOperation('evidence-explorer') === 'evidence-explorer');
assert('evidence-explorer → explorer action', asiOperationToAction('evidence-explorer') === 'explorer');
assert('competitor-gap resolves', resolveAsiOperation('competitor-gap') === 'competitor-gap');
assert('competitor-gap → gap action', asiOperationToAction('competitor-gap') === 'gap');
assert('next-best-action resolves', resolveAsiOperation('next-best-action') === 'next-best-action');
assert('next-best-action → action', asiOperationToAction('next-best-action') === 'action');
assert('visibility-monitor → visibility action', asiOperationToAction('visibility-monitor') === 'visibility');
assert('war-room resolves', resolveAsiOperation('war-room') === 'war-room');
assert('brand-perception resolves', resolveAsiOperation('brand-perception') === 'brand-perception');
assert('perception alias', resolveAsiOperation('perception') === 'brand-perception');
assert('recommendation alias', resolveAsiOperation('recommendation') === 'recommendation-test');
assert('evidence alias', resolveAsiOperation('evidence') === 'citation-explorer');
assert('unknown operation', resolveAsiOperation('not-real') === null);
assert('tabId questions alias', resolveAsiOperation('questions') === 'query-generator');
assert('tabId opportunity alias', resolveAsiOperation('opportunity') === 'opportunity-finder');
assert('tabId gap alias', resolveAsiOperation('gap') === 'competitor-gap');
assert('tabId visibility-trend alias', resolveAsiOperation('visibility-trend') === 'visibility-monitor');
assert('brand-perception → perception action', asiOperationToAction('brand-perception') === 'perception');
assert('share-of-voice → recommendation action', asiOperationToAction('share-of-voice') === 'recommendation');

assert('401 is api_key', classifyHttpStatus(401) === 'api_key');
assert('403 is api_key', classifyHttpStatus(403) === 'api_key');
assert('429 is rate_limit', classifyHttpStatus(429) === 'rate_limit');
assert('504 is provider_timeout', classifyHttpStatus(504) === 'provider_timeout');
assert('400 is invalid_response', classifyHttpStatus(400) === 'invalid_response');
assert('500 is unavailable', classifyHttpStatus(500) === 'unavailable');

assert('abort classifies timeout', classifyAsiThrown(Object.assign(new Error('aborted'), { name: 'AbortError' })).code === 'provider_timeout');
assert('429 message classifies rate_limit', classifyAsiThrown(new Error('OpenAI HTTP 429')).code === 'rate_limit');
assert('401 message classifies api_key', classifyAsiThrown(new Error('HTTP 401 unauthorized')).code === 'api_key');
assert('empty answer classifies invalid_response', classifyAsiThrown(new Error('OpenAI returned an empty answer')).code === 'invalid_response');
assert('fetch typeerror classifies network', classifyAsiThrown(Object.assign(new Error('fetch failed'), { name: 'TypeError' })).code === 'network_error');
assert('AsiServiceError keeps code', classifyAsiThrown(new AsiServiceError('rate_limit')).code === 'rate_limit');

assert('rate_limit http 429', httpStatusForAsiError('rate_limit') === 429);
assert('cancelled http 499', httpStatusForAsiError('cancelled') === 499);
assert('timeout http 504', httpStatusForAsiError('provider_timeout') === 504);
assert('cancel message classifies cancelled', classifyAsiThrown(new Error('request cancelled')).code === 'cancelled');
assert('invalid_url http 422', httpStatusForAsiError('invalid_url') === 422);
assert('entitlement http 403', httpStatusForAsiError('entitlement') === 403);
assert('entitlement_quota http 403', httpStatusForAsiError('entitlement_quota') === 403);

const requestId = createAsiRequestId();
assert('requestId prefix', requestId.startsWith('asi_'));
assert('redacts openai key', redactAsiSecrets('Bearer sk-proj-abc123XYZ').includes('[redacted]'));
assert('redacts sk token', !redactAsiSecrets('key=sk-ant-secretvalue').includes('sk-ant-secretvalue'));
assert('redacts google-shaped token', redactAsiSecrets('AIzaSyPLACEHOLDERVALUE0000').includes('[redacted]'));

const meta = asiEnvelopeMeta({ mode: 'mock', provider: 'openai', requestId, operation: 'war-room' });
const ok = asiSuccessEnvelope({ snapshot: { ok: true } }, meta);
assert('success envelope', ok.success === true && ok.error === null && ok.data && ok.meta.requestId === requestId);
const fail = asiErrorEnvelope('api_key', meta, 'ko');
assert('error envelope', fail.body.success === false && fail.body.data === null && fail.body.error?.code === 'api_key');
assert('error message is not technical', !fail.body.error?.message.toLowerCase().includes('http'));
assert('safe ko api_key', asiSafeErrorMessage('api_key', 'ko').includes('AI 분석을 완료하지 못했습니다'));
assert('safe ko has no vendor name', !asiSafeErrorMessage('unavailable', 'ko').includes('OpenAI'));

const copy = asiFailCopy('URL 오류', (key) =>
	key === 'errors.timeout' ? '시간 초과' : key === 'analyzeFailed' ? '실패' : key,
);
assert('ui maps timeout', asiLoadMessage('provider_timeout', copy) === '시간 초과');
assert('ui maps invalid url', asiLoadMessage('invalid_url', copy) === 'URL 오류');
assert('ui fallback unavailable', asiLoadMessage('unavailable', copy) === '실패');

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
