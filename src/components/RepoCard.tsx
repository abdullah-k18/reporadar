import type { Recommendation } from "@/lib/types";

export function RepoCard({
  rec,
  saved,
  onSave,
  onReject,
  onUnsave,
}: {
  rec: Recommendation;
  saved?: boolean;
  onSave?: () => void;
  onReject?: () => void;
  onUnsave?: () => void;
}) {
  return (
    <article className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <a href={rec.url} target="_blank" rel="noreferrer" className="break-all text-lg font-semibold hover:text-accent">
            {rec.fullName}
          </a>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
            {rec.language && <span>{rec.language}</span>}
            <span>★ {rec.stars.toLocaleString()}</span>
            <span className="capitalize">{rec.level === "big" ? "big project" : `${rec.level} level`}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {onSave && (
            <button className="btn" disabled={saved} onClick={onSave}>
              {saved ? "★ Saved" : "☆ Save"}
            </button>
          )}
          {onUnsave && <button className="btn" onClick={onUnsave}>Remove</button>}
          {onReject && <button className="btn" onClick={onReject}>✕ Not for me</button>}
        </div>
      </div>

      {rec.description && <p className="mt-3 text-sm">{rec.description}</p>}

      {rec.whyItFits && (
        <div className="mt-3 rounded-lg bg-accent-soft p-3 text-sm">
          <p><span className="font-medium">Why it fits you: </span>{rec.whyItFits}</p>
          {rec.starterTip && <p className="mt-1.5"><span className="font-medium">Start here: </span>{rec.starterTip}</p>}
        </div>
      )}

      <h3 className="mt-4 text-sm font-medium">Open, unassigned issues</h3>
      <ul className="mt-2 space-y-2">
        {rec.issues.map((i) => (
          <li key={i.number} className="text-sm">
            <a href={i.url} target="_blank" rel="noreferrer" className="hover:text-accent">
              <span className="text-muted">#{i.number}</span> {i.title}
            </a>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {i.labels.slice(0, 4).map((l) => (
                <span key={l} className="rounded border border-line px-1.5 text-xs text-muted">{l}</span>
              ))}
              <span className="text-xs text-muted">· {i.comments} comments</span>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
