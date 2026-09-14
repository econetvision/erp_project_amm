import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMySubscription } from "../../api/subscriptionApi";
import { getInvoices } from "../../api/invoiceApi";
import AlertMessage from "../../components/AlertMessage";
import SeatUsageWidget from "../../components/SeatUsageWidget";
import { statusBadge, seatsLabel } from "../master/SubscriptionList";
import { money, invoiceBadge } from "../master/InvoiceList";
import type { SubscriptionDetail } from "../../types/subscription";
import type { Invoice } from "../../types/invoice";

export default function SubscriptionInfo() {
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getMySubscription(), getInvoices()])
      .then(([s, i]) => { setSub(s.data); setInvoices(i.data); })
      .catch((e: any) => setAlert({ type: "warning", message: e.message }))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return <div className="container py-4">Loading…</div>;

  return (
    <div className="container py-4">
      <h4 className="mb-3">Subscription</h4>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />
      {!sub ? (
        <p className="text-muted">No subscription is on record for your company. Contact your provider.</p>
      ) : (
        <>
          <SeatUsageWidget />
          <div className="row g-3 mb-4">
            <div className="col-md-3"><div className="card h-100"><div className="card-body">
              <div className="text-muted small">Plan</div>
              <div className="fs-5 text-capitalize">{sub.plan} <span className={`badge bg-${statusBadge(sub.status)} ms-1`}>{sub.status}</span></div>
            </div></div></div>
            <div className="col-md-3"><div className="card h-100"><div className="card-body">
              <div className="text-muted small">Renewal</div>
              <div className="fs-5">{sub.ends_at ? new Date(sub.ends_at).toLocaleDateString() : "No expiry"}</div>
              {sub.days_to_renewal !== null && <div className="small text-muted">{sub.days_to_renewal} days</div>}
            </div></div></div>
            <div className="col-md-3"><div className="card h-100"><div className="card-body">
              <div className="text-muted small">Seats</div><div className="fs-5">{seatsLabel(sub.seats_used, sub.capacity)}</div>
            </div></div></div>
            <div className="col-md-3"><div className="card h-100"><div className="card-body">
              <div className="text-muted small">Admins</div><div className="fs-5">{sub.admins_used} / {sub.admin_cap}</div>
            </div></div></div>
          </div>

          <div className="card mb-4"><div className="card-header">Licensed sites</div>
            <div className="table-responsive"><table className="table table-sm align-middle mb-0">
              <thead><tr><th>Site</th><th>Seats</th><th>Admins</th><th>Status</th><th>Since</th></tr></thead>
              <tbody>
                {sub.licenses.filter(l => l.status === "active").length === 0
                  ? <tr><td colSpan={5} className="text-center text-muted py-3">No active licences.</td></tr>
                  : sub.licenses.filter(l => l.status === "active").map(l => (
                    <tr key={l.id}>
                      <td>{l.site_name || "Company-wide"}</td>
                      <td>{l.max_users === null ? "Unlimited" : l.max_users}</td>
                      <td>{l.max_admins}</td>
                      <td><span className="badge bg-success">active</span></td>
                      <td>{l.granted_at ? new Date(l.granted_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      <div className="card"><div className="card-header">Invoice history</div>
        <div className="table-responsive"><table className="table table-sm align-middle mb-0">
          <thead><tr><th>Number</th><th>Period</th><th>Due</th><th className="text-end">Total</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.length === 0 ? <tr><td colSpan={5} className="text-center text-muted py-3">No invoices.</td></tr>
            : invoices.map(inv => (
              <tr key={inv.id}>
                <td><button className="btn btn-link p-0" onClick={() => navigate(`/master/invoices/${inv.id}`)}>{inv.invoice_number}</button></td>
                <td>{inv.period_start} → {inv.period_end}</td>
                <td>{inv.due_date}</td>
                <td className="text-end">{money(inv.total, inv.currency)}</td>
                <td><span className={`badge bg-${invoiceBadge(inv.status)}`}>{inv.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
