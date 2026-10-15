"use client";
import { useState } from "react";

type Identity = { id: string; name: string; role: string };
export function IdentitySwitcher({ identities, current, variant = "header" }: { identities: Identity[]; current?: Identity | null; variant?: "header" | "welcome" }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [selected, setSelected] = useState(current?.id ?? identities.find(person => person.role === "preparer")?.id ?? identities[0]?.id ?? "");
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
  const welcome = variant === "welcome";
  const id = welcome ? "starting-identity" : "demo-identity";
  const selector = <>
    <label htmlFor={id}>{welcome ? "Start as" : "Demo identity"}</label>
    <select id={id} name="identityId" value={welcome ? selected : current?.id ?? ""} disabled={busy} onChange={event => { setSelected(event.target.value); if (!welcome) void select(event.target.value); }}>
      <option value="" disabled>Choose a person to begin</option>
      <optgroup label="Firm team">
        {identities.filter(person => person.role !== "client").map(person => <option key={person.id} value={person.id}>{person.name} · {person.role.replaceAll("_", " ")}</option>)}
      </optgroup>
      <optgroup label="Clients — restricted workspace">
        {identities.filter(person => person.role === "client").map(person => <option key={person.id} value={person.id}>{person.name} · client</option>)}
      </optgroup>
    </select>
    {welcome && <button className="button" type="submit" disabled={busy || !selected}>{busy ? "Opening…" : "Open workspace"}</button>}
    {!welcome && <noscript><button className="button secondary" type="submit">Switch identity</button></noscript>}
    <span className="sr-only" role="status">{busy ? "Switching identity…" : ""}</span>
    {error && <p role="alert" className="error-text">{error}</p>}
  </>;
  return <form className={`identity-control${welcome ? " welcome-identity" : ""}`} action="/api/demo-session" method="post" onSubmit={event => { event.preventDefault(); void select(selected); }}>{selector}</form>;
}
