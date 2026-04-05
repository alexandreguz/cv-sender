"use client";
// Global navigation header.
// Uses usePathname() to highlight the currently active link.
import Link from "next/link";
import { usePathname } from "next/navigation";

// All top-level navigation links in display order
const NAV_LINKS = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/keywords",     label: "Keywords" },
  { href: "/scrapers",     label: "Scrapers" },
  { href: "/profile",      label: "Base Profile" },
  { href: "/cv-profiles",  label: "CV Profiles" },
  { href: "/preview",      label: "Preview" },
  { href: "/applications", label: "Applications" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-[#1a3350] text-white">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Logo / home link */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <span className="text-lg font-bold tracking-tight">cv-sender</span>
        </Link>

        <nav>
          <ul className="flex flex-wrap gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              // A link is active when the current path matches or starts with its href
              const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white font-medium"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

      </div>
    </header>
  );
}
