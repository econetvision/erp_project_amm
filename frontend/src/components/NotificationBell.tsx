import { useEffect, useState, useRef } from "react";
import { getNotifications, getUnreadCount, markRead, markAllRead } from "../api/notificationApi";
import type { Notification } from "../types/job";

export default function NotificationBell() {
  const [count, setCount]           = useState(0);
  const [open, setOpen]             = useState(false);
  const [items, setItems]           = useState<Notification[]>([]);
  const [loading, setLoading]       = useState(false);
  const ref                         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function fetchCount() {
    try {
      const { data } = await getUnreadCount();
      setCount(data.count);
    } catch { /* ignore */ }
  }

  async function toggle() {
    if (!open) {
      setLoading(true);
      try {
        const { data } = await getNotifications();
        setItems(data);
      } catch { /* ignore */ }
      setLoading(false);
    }
    setOpen(!open);
  }

  async function handleMarkRead(id: number) {
    await markRead(id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setCount(c => Math.max(0, c - 1));
  }

  async function handleMarkAll() {
    await markAllRead();
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setCount(0);
  }

  return (
    <div className="position-relative" ref={ref}>
      <button className="btn btn-link nav-link position-relative p-1" onClick={toggle} title="Notifications">
        <span style={{ fontSize: "1.2rem" }}>🔔</span>
        {count > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: "0.65rem" }}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="dropdown-menu show shadow"
          style={{ position: "absolute", right: 0, top: "100%", width: 340, maxHeight: 400, overflowY: "auto", zIndex: 1050 }}
        >
          <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
            <h6 className="mb-0 fw-bold">Notifications</h6>
            {count > 0 && (
              <button className="btn btn-sm btn-link p-0" onClick={handleMarkAll}>Mark all read</button>
            )}
          </div>
          {loading ? (
            <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>
          ) : items.length === 0 ? (
            <div className="text-center text-muted py-3">No notifications</div>
          ) : (
            items.map(n => (
              <div
                key={n.id}
                className={`px-3 py-2 border-bottom ${!n.is_read ? "bg-light" : ""}`}
                style={{ cursor: n.is_read ? "default" : "pointer" }}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
              >
                <div className="d-flex justify-content-between">
                  <strong className="small">{n.title}</strong>
                  {!n.is_read && <span className="badge bg-primary" style={{ fontSize: "0.6rem" }}>NEW</span>}
                </div>
                {n.body && <div className="small text-muted">{n.body}</div>}
                <div className="text-muted" style={{ fontSize: "0.7rem" }}>{new Date(n.created_at).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
