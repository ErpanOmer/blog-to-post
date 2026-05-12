import type { Env, PlatformType } from "@/worker/types";
import type { AccountService, AccountServiceConstructor } from "@/worker/accounts/types";

export const accountServiceRegistry: Map<PlatformType, AccountServiceConstructor> = new Map();
let runtimeEnv: Env | undefined;

export function setAccountServiceRuntimeEnv(env: Env | undefined): void {
	runtimeEnv = env;
}

export function registerAccountService(platform: PlatformType, serviceClass: AccountServiceConstructor): void {
	accountServiceRegistry.set(platform, serviceClass);
}

export function getAccountService(platform: PlatformType, authToken: string, env?: Env): AccountService | null {
	const ServiceClass = accountServiceRegistry.get(platform);
	if (!ServiceClass) {
		return null;
	}
	return new ServiceClass(authToken, env ?? runtimeEnv);
}
