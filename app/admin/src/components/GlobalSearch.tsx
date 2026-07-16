import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Command, CornerDownLeft, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { adminRequest } from "../lib/api";
import type { JsonObject } from "../lib/types";
import { EmptyState, IconButton, LoadingState, StatusBadge } from "./ui";

type SearchResult = JsonObject & {
  resourceType: string;
  resourceId: string;
  title: string;
  subtitle: string;
  route: string;
};

export function GlobalSearch() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const query = useQuery({
    queryKey: ["admin-search", q],
    queryFn: () => adminRequest<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
    enabled: open && q.trim().length >= 2,
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  function choose(result: SearchResult) {
    setOpen(false);
    setQ("");
    navigate(result.route);
  }

  return (
    <>
      <button type="button" className="global-search-trigger" onClick={() => setOpen(true)}>
        <Search size={17} />
        <span>{t("search")}</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open ? (
        <div className="command-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="command-panel" role="dialog" aria-modal="true" aria-label={t("globalSearch")}>
            <header>
              <Command size={19} />
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("searchPlaceholder")} autoFocus />
              <IconButton label={t("close")} onClick={() => setOpen(false)}><X size={18} /></IconButton>
            </header>
            <div className="command-results">
              {q.trim().length < 2 ? <div className="command-hint">{t("searchHint")}</div> : null}
              {query.isLoading ? <LoadingState /> : null}
              {query.data?.length === 0 ? <EmptyState /> : null}
              {query.data?.map((result) => (
                <button type="button" key={`${result.resourceType}:${result.resourceId}`} onClick={() => choose(result)}>
                  <span className="result-type">{result.resourceType}</span>
                  <span className="result-main"><strong>{result.title}</strong><code>{result.subtitle || result.resourceId}</code></span>
                  <StatusBadge status="open" />
                  <CornerDownLeft size={16} />
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
