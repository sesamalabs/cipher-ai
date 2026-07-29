"use client";

import Link from "next/link";

export default function Sidebar({ active }) {
  return (
    <aside className="sidebar">
      <div className="logo">
        CIPHER<span>.</span>
      </div>
      <Link className={"nav-item" + (active === "dashboard" ? " active" : "")} href="/">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
        <span>Dashboard</span>
      </Link>
      <Link
        className={"nav-item" + (active === "learning" ? " active" : "")}
        href="/learning"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 6.5c-1.6-1.1-4.2-1.6-6-1.1v13.1c1.8-.5 4.4 0 6 1.1 1.6-1.1 4.2-1.6 6-1.1V5.4c-1.8-.5-4.4 0-6 1.1z" />
          <path d="M12 6.5v13.1" />
        </svg>
        <span>Pembelajaran</span>
      </Link>
      <div className="nav-footer">Sesama Labs · v0.7</div>
    </aside>
  );
}
