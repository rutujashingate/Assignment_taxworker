import { pgTable, text, integer, boolean, timestamp, date, jsonb, customType, primaryKey, bigint, uuid } from "drizzle-orm/pg-core";
import type { PacketDocument, PacketVersion } from "../packet/schema";
import type { CheckResult, IssueState } from "../review/types";
import type { ItemKind } from "../collaboration/types";

const bytes = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
export const packetImports = pgTable("packet_import", {
  packetHash: text("packet_hash").primaryKey(), rawBytes: bytes("raw_bytes").notNull(),
  rawJson: jsonb("raw_json").notNull(), importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
});
export const engagements = pgTable("engagement", {
  clientId: text("client_id").notNull(), taxYear: integer("tax_year").notNull(),
  packetHash: text("packet_hash").notNull(), name: text("name").notNull(),
}, t => [primaryKey({ columns: [t.clientId, t.taxYear] })]);
export const sourceDocuments = pgTable("source_document", {
  packetHash: text("packet_hash").notNull(), documentId: text("document_id").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  record: jsonb("record").$type<PacketDocument>().notNull(),
}, t => [primaryKey({ columns: [t.packetHash, t.documentId] })]);
export const sourceValues = pgTable("source_value", {
  packetHash: text("packet_hash").notNull(), valueId: text("value_id").notNull(),
  documentId: text("document_id").notNull(), record: jsonb("record").notNull(),
}, t => [primaryKey({ columns: [t.packetHash, t.valueId] })]);
export const engineVersions = pgTable("engine_version", {
  packetHash: text("packet_hash").notNull(), version: text("version").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
  record: jsonb("record").$type<PacketVersion>().notNull(),
}, t => [primaryKey({ columns: [t.packetHash, t.version] })]);
export const engineLines = pgTable("engine_line", {
  packetHash: text("packet_hash").notNull(), version: text("version").notNull(),
  lineKey: text("line_key").notNull(), record: jsonb("record").notNull(),
}, t => [primaryKey({ columns: [t.packetHash, t.version, t.lineKey] })]);
export const packetAuxiliary = pgTable("packet_auxiliary", {
  packetHash: text("packet_hash").notNull(), section: text("section").notNull(), record: jsonb("record").notNull(),
}, t => [primaryKey({ columns: [t.packetHash, t.section] })]);
export const identities = pgTable("demo_identity", {
  id: text("id").primaryKey(), name: text("name").notNull(), role: text("role").notNull(),
  sensitiveDataClearance: boolean("sensitive_data_clearance").notNull(), activeFrom: date("active_from").notNull(),
});
export type Actor = typeof identities.$inferSelect;
export const engagementAccess = pgTable("engagement_access", {
  actorId: text("actor_id").notNull(), clientId: text("client_id").notNull(), taxYear: integer("tax_year").notNull(),
}, t => [primaryKey({ columns: [t.actorId, t.clientId, t.taxYear] })]);
export const sessions = pgTable("demo_session", {
  id: uuid("id").primaryKey(), actorId: text("actor_id").notNull(), signingKey: bytes("signing_key").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const preferences = pgTable("workpaper_preference", {
  actorId: text("actor_id").notNull(), clientId: text("client_id").notNull(), taxYear: integer("tax_year").notNull(),
  selectedVersion: text("selected_version").notNull(), revision: integer("revision").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [primaryKey({ columns: [t.actorId, t.clientId, t.taxYear] })]);
export const auditEvents = pgTable("audit_event", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  actorId: text("actor_id").notNull(), clientId: text("client_id").notNull(), taxYear: integer("tax_year").notNull(),
  action: text("action").notNull(), target: text("target").notNull(),
  beforeJson: jsonb("before_json"), afterJson: jsonb("after_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const workpaperIssues = pgTable("workpaper_issue", {
  clientId: text("client_id").notNull(), taxYear: integer("tax_year").notNull(), version: text("version").notNull(),
  issueKey: text("issue_key").notNull(), finding: jsonb("finding").$type<CheckResult>().notNull(), fingerprint: text("fingerprint").notNull(),
  status: text("status").$type<IssueState>().notNull().default("open"), assigneeId: text("assignee_id"), note: text("note").notNull().default(""),
  evidenceRefs: jsonb("evidence_refs").$type<string[]>().notNull().default([]), revision: integer("revision").notNull().default(1),
  updatedBy: text("updated_by").notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [primaryKey({columns:[t.clientId,t.taxYear,t.version,t.issueKey]})]);

export const collaborationItems = pgTable("collaboration_item", {
  id: uuid("id").primaryKey(), clientId: text("client_id").notNull(), taxYear: integer("tax_year").notNull(),
  kind: text("kind").$type<ItemKind>().notNull(), audience: text("audience").$type<'internal'|'client'>().notNull(),
  title: text("title").notNull(), body: text("body").notNull(), sourceRefs: jsonb("source_refs").$type<string[]>().notNull().default([]),
  assigneeId: text("assignee_id"), dueDate: date("due_date"), blocksFiling: boolean("blocks_filing").notNull().default(false),
  status: text("status").$type<'open'|'answered'|'closed'>().notNull().default('open'), revision: integer("revision").notNull().default(1),
  createdBy: text("created_by").notNull(), updatedBy: text("updated_by").notNull(),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(), updatedAt: timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
});
export const collaborationMessages = pgTable("collaboration_message", {
  id: uuid("id").primaryKey(), itemId: uuid("item_id").notNull(), kind: text("kind").$type<'reply'|'answer'>().notNull(),
  body: text("body").notNull(), createdBy: text("created_by").notNull(), createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
export const collaborationAttachments = pgTable("collaboration_attachment", {
  id: uuid("id").primaryKey(), itemId: uuid("item_id").notNull(), kind: text("kind").$type<'file'|'note'>().notNull(),
  name: text("name").notNull(), note: text("note"), content: bytes("content"), mediaType: text("media_type").notNull(),
  sha256: text("sha256").notNull(), sensitive: boolean("sensitive").notNull().default(true), createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
export const collaborationNotifications = pgTable("collaboration_notification", {
  id: uuid("id").primaryKey(), itemId: uuid("item_id").notNull(), recipientId: text("recipient_id").notNull(), event: text("event").notNull(),
  readAt: timestamp("read_at",{withTimezone:true}), createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});

export const salesLotReviews = pgTable('sales_lot_review', {
  clientId:text('client_id').notNull(),taxYear:integer('tax_year').notNull(),version:text('version').notNull(),lineKey:text('line_key').notNull(),
  status:text('status').$type<'reviewed'|'needs_review'>().notNull(),reason:text('reason').notNull(),sourceRefs:jsonb('source_refs').$type<string[]>().notNull(),
  revision:integer('revision').notNull(),updatedBy:text('updated_by').notNull(),updatedAt:timestamp('updated_at',{withTimezone:true}).defaultNow().notNull(),
},t=>[primaryKey({columns:[t.clientId,t.taxYear,t.version,t.lineKey]})]);
export const firmStandards = pgTable('firm_standard', {
  packetHash:text('packet_hash').primaryKey(),record:jsonb('record').notNull(),revision:integer('revision').notNull(),updatedBy:text('updated_by').notNull(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
export const timeEntries = pgTable('work_time_entry', {
  id:uuid('id').primaryKey(),clientId:text('client_id').notNull(),taxYear:integer('tax_year').notNull(),actorId:text('actor_id').notNull(),category:text('category').notNull(),
  minutes:integer('minutes').notNull(),workedOn:date('worked_on').notNull(),note:text('note').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
});
