"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function VersionPicker({ clientId, taxYear, initial, versions }: {
  clientId: string; taxYear: number; initial: { selectedVersion: string; revision: number };
  versions: { version: string; computedAt: string }[];
}) {
  const router = useRouter(); const [preference, setPreference] = useState(initial);
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function save(selectedVersion: string) {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/engagements/${clientId}/${taxYear}/preferences`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedVersion, expectedRevision: preference.revision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Your preference could not be saved.");
      setPreference(result); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setSaving(false); }
  }
  return <div className="version-picker">
    <label htmlFor="computed-version">Computed version</label>
    <select id="computed-version" value={preference.selectedVersion} disabled={saving || Boolean(error)} onChange={event => void save(event.target.value)}>
      {versions.map(version => <option key={version.version} value={version.version}>{version.version}{version.version === "v3" ? " · latest" : " · historical"}</option>)}
    </select>
    <span className="save-status" role="status">{saving ? "Saving…" : preference.revision ? `Saved · revision ${preference.revision}` : "Default view · choose a version to save"}</span>
    <noscript><p className="fine-print">Enable JavaScript to save a different computed-version preference. Navigation and identity selection work without it.</p></noscript>
    {error && <div className="preference-error"><p role="alert">{error}</p><button className="text-button" onClick={() => window.location.reload()}>Reload current preference</button></div>}
  </div>;
}
