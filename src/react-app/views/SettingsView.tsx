import { PlatformSettings } from "../components/PlatformSettings";

interface SettingsViewProps {
    providerStatus: {
        provider: string;
        ready: boolean;
        lastCheckedAt: number;
        message: string
    } | null;
}

export function SettingsView({ providerStatus }: SettingsViewProps) {
    return <PlatformSettings providerStatus={providerStatus} />;
}
