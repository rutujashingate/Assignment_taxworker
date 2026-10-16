import Link from 'next/link';
export function SourceDateUnavailable() {
  return <section className="section-panel season-panel"><h2>No computed return at this date</h2><p>This view needs a computed return for its line and source index. Replay to the first computation (March 4, 2026) or later. The original packet and saved workpaper decisions are preserved.</p><Link className="button secondary" href="/engagements/CL-20417/2025/history">Open season replay</Link></section>;
}
