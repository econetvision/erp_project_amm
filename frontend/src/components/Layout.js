import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export default function Layout() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="container mt-4 mb-5 flex-grow-1">
        <Outlet />
      </div>

      {/* Footer */}
      <footer style={{ background: "#0a1628", color: "#c8d8f0" }}
              className="py-3 text-center small mt-auto">
        <span style={{ letterSpacing: "0.04em" }}>
          Supported by&nbsp;
          <span style={{ color: "#4ea8e8", fontWeight: 600 }}>EcoNetVision Pvt. Ltd.</span>
        </span>
        <span className="mx-2" style={{ color: "#2a4a6a" }}>|</span>
        <span style={{ color: "#c8d8f0" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="#4ea8e8"
               viewBox="0 0 16 16" style={{ marginBottom: "2px", marginRight: "4px" }}>
            <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.6 17.6 0 0 0 4.168 6.608 17.6 17.6 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.68.68 0 0 0-.58-.122l-2.19.547a1.75 1.75 0 0 1-1.657-.459L5.482 8.062a1.75 1.75 0 0 1-.46-1.657l.548-2.19a.68.68 0 0 0-.122-.58z"/>
          </svg>
          +91 9790840313
        </span>
        <span className="mx-2" style={{ color: "#2a4a6a" }}>|</span>
        <span style={{ color: "#4a6a8a", fontSize: "0.75rem" }}>© {new Date().getFullYear()} All rights reserved</span>
      </footer>
    </div>
  );
}
