import Stripe from 'stripe';

let client: Stripe | null = null;

/**
 * Lazily constructs the Stripe SDK client from `STRIPE_SECRET_KEY`. Unlike
 * Toss (which ships a public docs test key that works out of the box),
 * Stripe requires your own account — create one at https://dashboard.stripe.com,
 * grab the test **Secret key** from Developers → API keys, and set it in
 * `.env` (see `.env.example`). Throws a clear error at call time rather than
 * at import time so the rest of the app still boots without Stripe configured.
 */
export function getStripeClient(): Stripe {
	if (client) return client;
	const secretKey = process.env.STRIPE_SECRET_KEY;
	if (!secretKey) {
		throw new Error('STRIPE_SECRET_KEY is not configured. Add your Stripe test secret key to .env to enable overseas (USD) payments.');
	}
	client = new Stripe(secretKey);
	return client;
}

export function isStripeConfigured(): boolean {
	return Boolean(process.env.STRIPE_SECRET_KEY);
}
