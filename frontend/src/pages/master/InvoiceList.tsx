import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getInvoices, generateInvoice, markInvoicePaid, voidInvoice } from "../../api/invoiceApi";
import { getSubscriptions } from "../../api/subscriptionApi";
import AlertMessage from "../../components/AlertMessage";
import type { Invoice } from "../../types/invoice";
import type { Subscription } from "../../types/subscription";

export function money(v: string | number, currency: string): string {
  return `${currency} ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function invoiceBadge(status: string): string {
  return ({ draft: "secondary", sent: "info", paid: "success", void: "dark" } as Record<string, string>)[status] || "secondary";
}

function firstOfMonth(): string {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function lastOfMonth(): string {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [filterCompany, setFilterCompany] = useState<number>(0);
  const [filterStatus, setFilterStatus] = useState("");
  const [gen, setGen] = useState({ company_id: 0, period_start: firstOfMonth(), period_end: lastOfMonth() });
  const [payRef, setPayRef] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    try {
      const [i, s] = await Promise.all([
        getInvoices({ company_id: filterCompany || undefined, status: filterStatus || undefined }),
        getSubscriptions(),
      ]);
      setInvoices(i.data);
      setSubs(s.data);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }, [filterCompany, filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); setAlert({ type: "success", message: ok }); await load(); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setBusy(false); }
  }

  function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!gen.company_id) { setAlert({ type: "warning", message: "Select a company." }); return; }
    run(async () => {
      const r = await generateInvoice(gen);
      navigate(`/master/invoices/${r.data.id}`);
    }, "Invoice generated.");
  }

  return (
    <div className="container-fluid py-3">
      <h4 className="mb-3">Invoices</h4>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      <div className="card mb-3"><div className="card-header">Generate invoice</div><div className="card-body">
        <form className="row g-2 align-items-end" onSubmit={handleGenerate}>
          <div className="col-md-4"><label className="form-label">Company</label>
            <select className="form-select" value={gen.company_id} onChange={e => setGen(g => ({ ...g, company_id: Number(e.target.value) }))}>
              <option value={0}>Select…</option>
              {subs.map(s => <option key={s.id} value={s.company_id}>{s.company_name} ({s.active_licenses} licences)</option>)}
            </select></div>
          <div className="col-md-3"><label className="form-label">Period start</label>
            <input type="date" className="form-control" value={gen.period_start} onChange={e => setGen(g => ({ ...g, period_start: e.target.value }))} required /></div>
          <div className="col-md-3"><label className="form-label">Period end</label>
            <input type="date" className="form-control" value={gen.period_end} onChange={e => setGen(g => ({ ...g, period_end: e.target.value }))} required /></div>
          <div className="col-md-2"><button className="btn btn-primary w-100" disabled={busy}>Generate</button></div>
        </form>
      </div></div>

      <div className="d-flex gap-2 mb-2">
        <select className="form-select form-select-sm w-auto" value={filterCompany} onChange={e => setFilterCompany(Number(e.target.value))}>
          <option value={0}>All companies</option>
          {subs.map(s => <option key={s.id} value={s.company_id}>{s.company_name}</option>)}
        </select>
        <select className="form-select form-select-sm w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["draft", "sent", "paid", "void"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card"><div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead><tr><th>Number</th><th>Company</th><th>Period</th><th>Issued</th><th>Due</th><th className="text-end">Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {invoices.length === 0 ? <tr><td colSpan={8} className="text-center text-muted py-4">No invoices.</td></tr>
            : invoices.map(inv => (
              <tr key={inv.id}>
                <td><button className="btn btn-link p-0" onClick={() => navigate(`/master/invoices/${inv.id}`)}>{inv.invoice_number}</button></td>
                <td>{inv.company_name}</td>
                <td>{inv.period_start} → {inv.period_end}</td>
                <td>{inv.issue_date}</td>
                <td>{inv.due_date}</td>
                <td className="text-end">{money(inv.total, inv.currency)}</td>
                <td><span className={`badge bg-${invoiceBadge(inv.status)}`}>{inv.status}</span>{inv.payment_ref && <div className="small text-muted">{inv.payment_ref}</div>}</td>
                <td className="text-end">
                  {(inv.status === "draft" || inv.status === "sent") && (
                    <div className="d-inline-flex gap-1">
                      <input className="form-control form-control-sm" style={{ width: 130 }} placeholder="Payment ref"
                        value={payRef[inv.id] || ""} onChange={e => setPayRef(p => ({ ...p, [inv.id]: e.target.value }))} />
                      <button className="btn btn-success btn-sm" disabled={busy}
                        onClick={() => run(() => markInvoicePaid(inv.id, payRef[inv.id]), `${inv.invoice_number} marked paid.`)}>Paid</button>
                      <button className="btn btn-outline-dark btn-sm" disabled={busy}
                        onClick={() => run(() => voidInvoice(inv.id), `${inv.invoice_number} voided.`)}>Void</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}
