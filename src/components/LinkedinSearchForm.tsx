"use client";

import React, { useState } from "react";

type LinkedinSearchFormProps = {
  onScrapeFinished?: () => Promise<void> | void;
};

export default function LinkedinSearchForm({ onScrapeFinished }: LinkedinSearchFormProps) {
  const [keywords, setKeywords] = useState("QA Automation");
  const [location, setLocation] = useState("Israel");
  const [loading, setLoading] = useState(false);
  const [savedFile, setSavedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        setError(json?.error || "Erro ao executar o scraper");
      } else {
        setSavedFile(json?.name || null);
        setSuccess("Busca concluída. Os resultados estão atualizados na tabela.");
        if (typeof onScrapeFinished === "function") {
          await onScrapeFinished();
        }
      }
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-3">Buscar vagas no LinkedIn</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Palavra-chave</label>
          <input
            className="mt-1 block w-full border rounded px-2 py-1"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="ex: QA Automation Engineer"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Local</label>
          <input
            className="mt-1 block w-full border rounded px-2 py-1"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="ex: Israel, Brazil, Remote"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60 flex items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                Procurando...
              </>
            ) : "Pesquisar"}
          </button>
          <span className="text-sm text-gray-500">Obs: o scraper pode demorar e sofrer timeouts se o LinkedIn bloquear.</span>
        </div>
      </form>

      {error && <div className="mt-3 text-red-600">{error}</div>}

      {success && <div className="mt-3 text-green-600">{success}</div>}

      {savedFile && (
        <div className="mt-3 text-sm text-gray-700">Arquivo salvo: <strong>{savedFile}</strong> (pasta /data)</div>
      )}
    </section>
  );
}
