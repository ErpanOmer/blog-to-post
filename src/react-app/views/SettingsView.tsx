import { PlatformSettings } from "@/react-app/components/PlatformSettings";

interface SettingsViewProps {
    providerStatus: {
        provider: string;
        ready: boolean;
        lastCheckedAt: number;
        message: string;
        defaultModel?: string;
    } | null;
}

export function SettingsView({ providerStatus }: SettingsViewProps) {
    return <PlatformSettings providerStatus={providerStatus} />;
}
