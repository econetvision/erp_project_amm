import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function Layout() {
  return (
    <div className="erp-layout">
      <Sidebar />
      <div className="erp-layout__main">
        <Navbar />
        <div className="erp-layout__content">
          <Outlet />
        </div>
        <footer className="erp-layout__footer">
          <span>
            Supported by{" "}
            <strong>EcoNetVision Pvt. Ltd.</strong>
          </span>
          <span className="erp-layout__footer-sep">|</span>
          <span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor"
                 viewBox="0 0 16 16" style={{ marginBottom: 2, marginRight: 3, opacity: 0.7 }}>
              <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.6 17.6 0 0 0 4.168 6.608 17.6 17.6 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.68.68 0 0 0-.58-.122l-2.19.547a1.75 1.75 0 0 1-1.657-.459L5.482 8.062a1.75 1.75 0 0 1-.46-1.657l.548-2.19a.68.68 0 0 0-.122-.58z"/>
            </svg>
            +91 9790840313
          </span>
          <span className="erp-layout__footer-sep">|</span>
          <span style={{ opacity: 0.6 }}>© {new Date().getFullYear()} All rights reserved</span>
        </footer>
      </div>
    </div>
  );
}
