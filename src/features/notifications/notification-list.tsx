"use client";

import { useState } from "react";
import Link from "next/link";
import type { Notification } from "./contracts";

export function NotificationList({
  initialNotifications,
  institutionId,
  membershipId,
}: {
  initialNotifications: Notification[];
  institutionId: string;
  membershipId: string;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [error, setError] = useState<string | null>(null);

  async function markRead(notification: Notification) {
    if (notification.readAt) return;
    setError(null);
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-orion-institution-id": institutionId,
        "x-orion-membership-id": membershipId,
      },
      body: JSON.stringify({ notificationId: notification.id, expectedVersion: notification.version }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error?.message ?? "The notification could not be updated.");
      return;
    }
    setNotifications((current) => current.map((item) => item.id === notification.id
      ? { ...item, readAt: payload.data.readAt, version: payload.data.version }
      : item));
  }

  if (notifications.length === 0) {
    return <p className="rounded-xl border border-dashed border-stone-300 bg-white/60 p-5 text-sm text-stone-500">You have no notifications.</p>;
  }
  return (
    <div>
      {error ? <p role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200">
        {notifications.map((notification) => (
          <li key={notification.id} className={notification.readAt ? "bg-white/60" : "bg-cyan-50/70"}>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-stone-800">{notification.safeText}</p>
                <time className="mt-1 block text-xs text-stone-500" dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</time>
              </div>
              <div className="flex items-center gap-3">
                {notification.link ? <Link className="text-sm font-medium text-cyan-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-700" href={notification.link}>Open</Link> : null}
                {!notification.readAt ? <button className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 hover:border-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-700" type="button" onClick={() => void markRead(notification)}>Mark read</button> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
