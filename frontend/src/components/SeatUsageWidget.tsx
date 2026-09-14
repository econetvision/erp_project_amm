import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMySubscription } from "../api/subscriptionApi";
import type { SubscriptionDetail } from "../types/subscription";

/** Seat usage + renewal banner for admins. Fed by GET /api/subscriptions/my. Renders nothing on 404. */
export default function SeatUsageWidget() {
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);

  useEffect(() => {
    getMySubscription().then(r => setSub(r.data)).catch(() => setSub(null));
  }, []);

  if (!sub) return null;
  const atCap = sub.capacity !== null && sub.seats_used >= sub.capacity;
  const pct = sub.capacity ? Math.min(100, Math.round(sub.seats_used / sub.capacity * 100)) : 0;
  const color = atCap ? "danger" : pct >= 80 ? "warning" : "success";
  const days = sub.days_to_renewal;
  const expiringSoon = days !== null && days <= 30;

  return (
    <div className="card shadow-sm mb-4" style={{ cursor: "pointer" }} onClick={() => navigate("/subscription")}>
      <div className="card-body py-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <div className="text-muted small">Licensed seats</div>
            <div className="fs-5 fw-semibold">
              {sub.capacity === null ? `${sub.seats_used} seats (unlimited)` : `${sub.seats_used} / ${sub.capacity} seats`}
            </div>
          </div>
          <div className="text-end small text-muted">
            {sub.admins_used} / {sub.admin_cap} admins · {sub.active_licenses} licence{sub.active_licenses === 1 ? "" : "s"}
          </div>
        </div>
        {sub.capacity !== null && (
          <div className="progress mt-2" style={{ height: 8 }}>
            <div className={`progress-bar bg-${color}`} role="progressbar" style={{ width: `${pct}%` }} />
          </div>
        )}
        {expiringSoon && days !== null && (
          <div className={`alert alert-${days < 0 ? "danger" : "warning"} py-1 px-2 mt-2 mb-0 small`}>
            {days < 0
              ? "Your subscription has expired. Contact your provider to renew."
              : `Your subscription renews in ${days} day${days === 1 ? "" : "s"}.`}
          </div>
        )}
        {!sub.is_valid && !expiringSoon && (
          <div className="alert alert-danger py-1 px-2 mt-2 mb-0 small">{sub.reason}</div>
        )}
      </div>
    </div>
  );
}
