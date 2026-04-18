import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	notificationManager,
	type Notification,
	type NotificationType,
} from "@/react-app/services/notification-service";

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const notificationConfig: Record<NotificationType, { icon: ReactNode; bgColor: string; borderColor: string; textColor: string }> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200/60",
    textColor: "text-emerald-700",
  },
  error: {
    icon: <AlertCircle className="h-4 w-4" />,
    bgColor: "bg-red-50",
    borderColor: "border-red-200/60",
    textColor: "text-red-700",
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200/60",
    textColor: "text-blue-700",
  },
  loading: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    textColor: "text-slate-700",
  },
};

function NotificationItem({ notification, onRemove }: NotificationItemProps) {
  const config = notificationConfig[notification.type];

  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        onRemove(notification.id);
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.duration, onRemove]);

  return (
    <div
      className={cn(
        "relative flex items-start gap-2.5 p-3.5 rounded-xl border shadow-elevated backdrop-blur-sm",
        "animate-in",
        config.bgColor,
        config.borderColor,
        config.textColor
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[13px]">{notification.title}</p>
        {notification.message && (
          <p className="text-[12px] opacity-75 mt-0.5">{notification.message}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(notification.id)}
        className="flex-shrink-0 p-1 rounded-md hover:bg-black/5 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// 通知容器组件
export function NotificationContainer() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    return notificationManager.subscribe(setNotifications);
  }, []);

  const handleRemove = useCallback((id: string) => {
    notificationManager.remove(id);
  }, []);

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 w-72 pointer-events-none">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationItem notification={notification} onRemove={handleRemove} />
        </div>
      ))}
    </div>
  );
}
