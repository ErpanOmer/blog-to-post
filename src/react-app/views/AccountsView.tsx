import { User } from "lucide-react";
import { SectionCard } from "@/react-app/components/SectionCard";
import { PlatformAccountsPanel } from "@/react-app/components/PlatformAccountsPanel";

export function AccountsView() {
    return (
        <SectionCard
            title="平台帐号管理"
            description="管理多平台发布所需的认证信息。"
            icon={<User className="h-5 w-5" />}
        >
            <PlatformAccountsPanel />
        </SectionCard>
    );
}
