import { DEFAULT_AS_OF } from "./schema";

export function isAvailable(date: string, asOf = DEFAULT_AS_OF) {
  const value = Date.parse(date); const cursor = Date.parse(asOf);
  return Number.isFinite(value) && Number.isFinite(cursor) && value <= cursor;
}

// Availability is based on receipt/knowledge dates, not a notice's printed date.
export function availableClientEvidence<T extends { questionnaire: Record<string, unknown>[]; messages: Record<string, unknown>[]; call_notes: Record<string, unknown>[] }>(client: T, asOf = DEFAULT_AS_OF) {
  return {
    questionnaire: client.questionnaire.filter(x => typeof x.answered_at === "string" && isAvailable(x.answered_at, asOf)),
    messages: client.messages.filter(x => typeof x.sent_at === "string" && isAvailable(x.sent_at, asOf)),
    call_notes: client.call_notes.filter(x => typeof x.date === "string" && isAvailable(x.date, asOf)),
  };
}

export function availableAgencyRecords(agency: Record<string, unknown>, documentReceipts: Map<string, string>, asOf = DEFAULT_AS_OF) {
  const dated = (items: unknown, key: string) => Array.isArray(items)
    ? items.filter(x => x && typeof x[key] === "string" && isAvailable(x[key], asOf)) : [];
  const notices = Array.isArray(agency.notices) ? agency.notices.filter(x => {
    if (!x || typeof x.document !== "string") return false;
    const received = documentReceipts.get(x.document);
    return received !== undefined && isAvailable(received, asOf);
  }) : [];
  const account = agency.ftb_account as Record<string, unknown> | undefined;
  return {
    irs_account_transcript_2025: dated(agency.irs_account_transcript_2025, "as_of"),
    ftb_account: account && typeof account.as_of === "string" && isAvailable(account.as_of, asOf) ? account : null,
    notices, efile: dated(agency.efile, "date"),
  };
}
