import { recordLabel } from '@/lib/evidence/format';

// Authorization and masking belong to the calling route. Preserve every field;
// this component only replaces JSON syntax with readable labels and lists.
export function ReadableRecord({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>Not supplied</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value !== 'object') return <span className="record-text">{typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 20 }) : String(value)}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span>None recorded</span>;
    return <ol className="readable-record-list">{value.map((item, index) => <li key={index}><ReadableRecord value={item}/></li>)}</ol>;
  }
  const entries = Object.entries(value);
  if (!entries.length) return <span>None recorded</span>;
  return <dl className="readable-record">{entries.map(([key, child]) => <div key={key}><dt>{recordLabel(key)}</dt><dd><ReadableRecord value={child}/></dd></div>)}</dl>;
}
