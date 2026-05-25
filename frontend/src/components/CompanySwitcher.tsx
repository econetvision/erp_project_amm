import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getCompanies } from "../api/companyApi";
import type { Company } from "../types/company";

export default function CompanySwitcher() {
  const { auth, switchCompany } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (auth?.role === "master") {
      getCompanies({ all: true }).then(r => setCompanies(r.data.items)).catch(() => {});
    }
  }, [auth]);

  if (auth?.role !== "master" || companies.length === 0) return null;

  const current = companies.find(c => c.id === auth?.company_id);

  return (
    <div className="position-relative">
      <button
        className="btn btn-sm btn-outline-light d-flex align-items-center gap-2"
        onClick={() => setOpen(!open)}
        title="Switch Company"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
          <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5zM10.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5zM2.5 10a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5zM10.5 10a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5z"/>
        </svg>
        <span className="d-none d-md-inline">
          {current ? current.name : "All Companies"}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16">
          <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
        </svg>
      </button>

      {open && (
        <div className="position-absolute end-0 mt-1 bg-white rounded shadow-lg border"
          style={{ zIndex: 1050, minWidth: 220, maxHeight: 300, overflowY: "auto" }}>
          <div className="p-2 border-bottom">
            <small className="text-muted fw-semibold">Switch Company</small>
          </div>
          <button
            className={`dropdown-item px-3 py-2 ${!auth?.company_id ? "active" : ""}`}
            onClick={() => { switchCompany(0); setOpen(false); }}
          >
            <strong>All Companies</strong>
            <small className="d-block text-muted">Global view</small>
          </button>
          {companies.map(c => (
            <button
              key={c.id}
              className={`dropdown-item px-3 py-2 ${auth?.company_id === c.id ? "active" : ""}`}
              onClick={() => { switchCompany(c.id); setOpen(false); }}
            >
              <span>{c.name}</span>
              <small className="d-block text-muted">{c.code}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
