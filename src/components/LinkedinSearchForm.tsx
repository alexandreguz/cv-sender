"use client";
// LinkedinSearchForm — triggers a LinkedIn scraping job via POST /api/scrape/linkedin.
// Accepts an optional onScrapeFinished callback so parent pages can refresh their data.
import React, { useState } from "react";

type Props = {
  /** Called after a successful scrape so the parent can reload results. */
  onScrapeFinished?: () => Promise<void> | void;
};

export default function LinkedinSearchForm({ onScrapeFinished }: Props) {
  const [keywords, setKeywords] = useState("QA Automation");
  const [location, setLocation] = useState("Israel");
  const [loading, setLoading] = useState(false);
  const [savedFile, setSavedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /** Sends the keyword + location to the scraper API and handles the response. */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSavedFile(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/scrape/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, location }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(String(json?.error ?? "Scraper error"));
      } else {
        setSavedFile(json?.name ?? null);
        setSuccess("Search complete. Results have been updated.");
        // Notify the parent so it can refresh the results table
        if (typeof onScrapeFinished === "function") {
          await onScrapeFinished();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-3">Search Jobs on LinkedIn</h2>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Keyword</label>
          <input
            className="mt-1 block w-full border rounded px-2 py-1"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. QA Automation Engineer"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Location</label>
          <input
            className="mt-1 block w-full border rounded px-2 py-1"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Israel, Brazil, Remote"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Searching...
              </>
            ) : (
              "Search"
            )}
          </button>
          <span className="text-sm text-gray-500">
            Note: the scraper may be slow or blocked by LinkedIn.
          </span>
        </div>
      </form>

      {/* Feedback messages */}
      {error && <div className="mt-3 text-red-600 text-sm">{error}</div>}
      {success && <div className="mt-3 text-green-600 text-sm">{success}</div>}
      {savedFile && (
        <div className="mt-3 text-sm text-gray-700">
          Saved file: <strong>{savedFile}</strong> (in /data folder)
        </div>
      )}
    </section>
  );
}
