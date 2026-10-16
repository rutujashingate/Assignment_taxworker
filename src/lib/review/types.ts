export const ISSUE_STATES = ["open", "investigating", "waiting", "explained", "resolved_with_evidence"] as const;
export type IssueState = typeof ISSUE_STATES[number];
export const STATE_LABELS: Record<IssueState, string> = { open: "Open", investigating: "Investigating", waiting: "Waiting", explained: "Explained", resolved_with_evidence: "Resolved with evidence" };
export const AREA_LABELS = { interest: "Interest", business: "Schedule C", payments: "California payments", capital_gains: "Sales detail", charity: "Charitable gifts", wages: "Wages" } as const;
export type TaxArea = keyof typeof AREA_LABELS;
export type CheckResult = {
  key: string; code: string; version: "v1" | "v2" | "v3"; title: string; taxArea: TaxArea;
  outcome: "pass" | "candidate" | "confirmed_mismatch" | "needs_information";
  severity: "info" | "warning" | "blocking"; certainty: "certain" | "probable" | "judgment";
  inputRefs: string[]; observed: Record<string, unknown>; expected: Record<string, unknown>;
  explanation: string; action: { label: string; ref: string };
};
export type IssueView = {
  key: string; version: string; finding: CheckResult; status: IssueState; assigneeId: string | null;
  note: string; evidenceRefs: string[]; revision: number; updatedAt: string;
};
