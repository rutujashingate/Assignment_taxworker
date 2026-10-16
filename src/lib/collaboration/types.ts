export const ITEM_KINDS = ['thread','question','review_note','task'] as const;
export type ItemKind = typeof ITEM_KINDS[number];
export type ItemView = {
  id: string; kind: ItemKind; audience: 'internal'|'client'; title: string; body: string; sourceRefs: string[];
  assigneeId: string|null; dueDate: string|null; blocksFiling: boolean; status: 'open'|'answered'|'closed';
  revision: number; createdBy: string; updatedBy: string; createdAt: string; updatedAt: string;
  messages: {id:string;ref:string;kind:'reply'|'answer';body:string;createdBy:string;createdAt:string}[];
  attachments: {id:string;ref:string;kind:'file'|'note';name:string;note:string|null;sensitive:boolean;restricted:boolean;createdBy:string;createdAt:string;sha256:string|null}[];
};
export type CollaborationData = {
  items: ItemView[]; people: {id:string;name:string;role:string}[];
  notifications: {id:string;itemId:string;title:string;event:string;readAt:string|null;createdAt:string}[];
  deadlines: {what:string;date:string}[]; assignments: {role:string;actorId:string}[];
  filingGate: {blocked:boolean;openNoteIds:string[];message:string}|null;
  canCreate:boolean;canReview:boolean;canReveal:boolean;cursor:string;actorId:string;client:boolean;
};
