import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type NotificationType = "success" | "error" | "info" | "loading";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  showSystemNotification?: boolean;
}

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const notificationConfig: Record<NotificationType, { icon: React.ReactNode; bgColor: string; borderColor: string; textColor: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
  },
  error: {
    icon: <AlertCircle className="h-5 w-5" />,
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-700",
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
  },
  loading: {
    icon: <Loader2 className="h-5 w-5 animate-spin" />,
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
        "relative flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm",
        "transform transition-all duration-300 ease-out",
        "animate-in slide-in-from-right-full fade-in",
        config.bgColor,
        config.borderColor,
        config.textColor
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{notification.title}</p>
        {notification.message && (
          <p className="text-xs opacity-80 mt-1">{notification.message}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(notification.id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// 全局通知管理
class NotificationManager {
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private notifications: Notification[] = [];

  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.notifications]));
  }

  add(notification: Omit<Notification, "id">) {
    const id = Math.random().toString(36).substring(2, 9);
    const newNotification = { ...notification, id };
    this.notifications = [...this.notifications, newNotification];
    this.notify();

    // 显示系统通知
    if (notification.showSystemNotification && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(notification.title, {
          body: notification.message,
          icon: "/favicon.ico",
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification(notification.title, {
              body: notification.message,
              icon: "/favicon.ico",
            });
          }
        });
      }
    }

    return id;
  }

  remove(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.notify();
  }

  update(id: string, updates: Partial<Notification>) {
    this.notifications = this.notifications.map((n) =>
      n.id === id ? { ...n, ...updates } : n
    );
    this.notify();
  }
}

export const notificationManager = new NotificationManager();

// 便捷方法
export const notify = {
  success: (title: string, message?: string, options?: { duration?: number; showSystemNotification?: boolean }) => {
    return notificationManager.add({
      type: "success",
      title,
      message,
      duration: options?.duration ?? 5000,
      showSystemNotification: options?.showSystemNotification ?? false,
    });
  },
  error: (title: string, message?: string, options?: { duration?: number; showSystemNotification?: boolean }) => {
    return notificationManager.add({
      type: "error",
      title,
      message,
      duration: options?.duration ?? 8000,
      showSystemNotification: options?.showSystemNotification ?? false,
    });
  },
  info: (title: string, message?: string, options?: { duration?: number; showSystemNotification?: boolean }) => {
    return notificationManager.add({
      type: "info",
      title,
      message,
      duration: options?.duration ?? 5000,
      showSystemNotification: options?.showSystemNotification ?? false,
    });
  },
  loading: (title: string, message?: string) => {
    return notificationManager.add({
      type: "loading",
      title,
      message,
      duration: 0, // 不会自动关闭
    });
  },
  remove: (id: string) => {
    notificationManager.remove(id);
  },
  update: (id: string, updates: Partial<Notification>) => {
    notificationManager.update(id, updates);
  },
};

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
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationItem notification={notification} onRemove={handleRemove} />
        </div>
      ))}
    </div>
  );
}
