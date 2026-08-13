import { redirect } from 'next/navigation';

/**
 * Canonical GNB route for the audit engine.
 * The scanner UI currently lives on `/`; keep a stable `/audit` entry that redirects.
 */
export default function AuditEnginePage() {
	redirect('/');
}
