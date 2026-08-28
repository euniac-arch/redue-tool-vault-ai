import type { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
	interface User extends DefaultUser {
		role?: string;
		isAdmin?: boolean;
	}

	interface Session {
		user: {
			id: string;
			role?: string;
			isAdmin?: boolean;
		} & DefaultSession['user'];
	}
}

declare module 'next-auth/jwt' {
	interface JWT {
		uid?: string;
		role?: string;
		isAdmin?: boolean;
	}
}
