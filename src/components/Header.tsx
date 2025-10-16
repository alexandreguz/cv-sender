import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-[#1a3350] text-white">
      <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" width={36} height={36} className="hidden sm:block" />
          <span className="text-lg font-bold">cv-sender</span>
        </Link>

        <nav>
          <ul className="flex gap-3">
            <li>
              <Link href="/dashboard" className="px-3 py-1 rounded bg-blue-600">
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/linkedin-results" className="px-3 py-1 rounded hover:bg-white/5">
                LinkedIn Results
              </Link>
            </li>
            <li>
              <Link href="/profile" className="px-3 py-1 rounded hover:bg-white/5">
                Profile
              </Link>
            </li>
            <li>
              <Link href="/preview" className="px-3 py-1 rounded hover:bg-white/5">
                Preview
              </Link>
            </li>
            <li>
              <Link href="/applications" className="px-3 py-1 rounded hover:bg-white/5">
                Applications
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}