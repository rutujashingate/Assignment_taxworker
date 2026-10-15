"use client";
import { useState } from "react";

type Identity = { id: string; name: string; role: string };
export function IdentitySwitcher({ identities, current }: { identities: Identity[]; current?: Identity | null }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function select(identityId: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/demo-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identityId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Identity could not be selected.");
      // Full navigation discards cached responses from the previous identity.
      window.location.assign(result.actor.role === "client" ? "/engagements/CL-20417/2025/workflow" : "/firm");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); setBusy(false); }
  }
  return <div className="identity-control">
    <label htmlFor="demo-identity">Demo identity</label>
    <select id="demo-identity" value={current?.id ?? ""} disabled={busy} onChange={event => void select(event.target.value)}>
      <option value="" disabled>Choose a person to begin</option>
      {identities.map(person => <option key={person.id} value={person.id}>{person.name} · {person.role.replaceAll("_", " ")}</option>)}
    </select>
    <span className="sr-only" role="status">{busy ? "Switching identity…" : ""}</span>
    {error && <p role="alert" className="error-text">{error}</p>}
  </div>;
}
