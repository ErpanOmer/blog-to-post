import type { PlatformType } from "../types";
import type { AccountService, AccountServiceConstructor } from "./types";

export const accountServiceRegistry: Map<PlatformType, AccountServiceConstructor> = new Map();

export function registerAccountService(platform: PlatformType, serviceClass: AccountServiceConstructor): void {
	accountServiceRegistry.set(platform, serviceClass);
}

export function getAccountService(platform: PlatformType, authToken: string): AccountService | null {
	const ServiceClass = accountServiceRegistry.get(platform);
	if (!ServiceClass) {
		return null;
	}
	return new ServiceClass(authToken);
}
