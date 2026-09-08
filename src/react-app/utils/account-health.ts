import type { PlatformAccount } from "@/react-app/api";

const VERIFY_STALE_DAYS = 7;

/** Days since last successful verification, or null when fresh/never verified. */
export function getVerifyStaleDays(account: PlatformAccount): number | null {
	if (!account.isVerified || !account.lastVerifiedAt) return null;
	const days = Math.floor((Date.now() - account.lastVerifiedAt) / 86_400_000);
	return days >= VERIFY_STALE_DAYS ? days : null;
}
