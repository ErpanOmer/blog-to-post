export type NotificationType = "success" | "error" | "info" | "loading";

export interface Notification {
	id: string;
	type: NotificationType;
	title: string;
	message?: string;
	duration?: number;
	showSystemNotification?: boolean;
}

type NotificationListener = (notifications: Notification[]) => void;

class NotificationManager {
	private listeners: NotificationListener[] = [];
	private notifications: Notification[] = [];

	subscribe(listener: NotificationListener) {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter((item) => item !== listener);
		};
	}

	private notifyAll() {
		const snapshot = [...this.notifications];
		for (const listener of this.listeners) {
			listener(snapshot);
		}
	}

	add(notification: Omit<Notification, "id">) {
		const id = Math.random().toString(36).substring(2, 9);
		const next = { ...notification, id };
		this.notifications = [...this.notifications, next];
		this.notifyAll();

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
		this.notifications = this.notifications.filter((item) => item.id !== id);
		this.notifyAll();
	}

	update(id: string, updates: Partial<Notification>) {
		this.notifications = this.notifications.map((item) => (
			item.id === id ? { ...item, ...updates } : item
		));
		this.notifyAll();
	}
}

export const notificationManager = new NotificationManager();

export async function requestNotificationPermission() {
	if (!("Notification" in window)) {
		console.warn("此浏览器不支持桌面通知");
		return false;
	}

	if (Notification.permission === "granted") {
		return true;
	}

	if (Notification.permission !== "denied") {
		const permission = await Notification.requestPermission();
		return permission === "granted";
	}

	return false;
}

type NotifyOptions = { duration?: number; showSystemNotification?: boolean };

export const notify = {
	success: (title: string, message?: string, options?: NotifyOptions) => (
		notificationManager.add({
			type: "success",
			title,
			message,
			duration: options?.duration ?? 5000,
			showSystemNotification: options?.showSystemNotification ?? false,
		})
	),
	error: (title: string, message?: string, options?: NotifyOptions) => (
		notificationManager.add({
			type: "error",
			title,
			message,
			duration: options?.duration ?? 8000,
			showSystemNotification: options?.showSystemNotification ?? false,
		})
	),
	info: (title: string, message?: string, options?: NotifyOptions) => (
		notificationManager.add({
			type: "info",
			title,
			message,
			duration: options?.duration ?? 5000,
			showSystemNotification: options?.showSystemNotification ?? false,
		})
	),
	loading: (title: string, message?: string) => (
		notificationManager.add({
			type: "loading",
			title,
			message,
			duration: 0,
		})
	),
	remove: (id: string) => {
		notificationManager.remove(id);
	},
	update: (id: string, updates: Partial<Notification>) => {
		notificationManager.update(id, updates);
	},
};
