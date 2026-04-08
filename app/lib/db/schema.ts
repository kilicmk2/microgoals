import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ===== NextAuth tables =====

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ===== App tables =====

export const goals = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("userId"),
  title: text("title").notNull(),
  description: text("description").default(""),
  status: text("status").default("not_started").notNull(),
  horizon: text("horizon").notNull(),
  category: text("category").notNull(),
  owner: text("owner").default(""),
  parentId: uuid("parentId"),
  reasoning: text("reasoning").default(""),
  pinned: boolean("pinned").default(false),
  order: integer("order").default(0),
  approved: boolean("approved").default(true),
  proposedBy: text("proposedBy"),
  workstream: text("workstream"),
  targetDate: text("targetDate"),
  estimatedHours: integer("estimatedHours"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
});

export const canvasNodes = pgTable("canvas_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("userId"),
  title: text("title").notNull(),
  description: text("description").default(""),
  status: text("status").default("not_started").notNull(),
  owner: text("owner").default(""),
  estimatedHours: integer("estimatedHours"),
  x: integer("x").default(100),
  y: integer("y").default(100),
  connectedTo: text("connectedTo").default("[]"),
  createdBy: text("createdBy"),
  lastEditedBy: text("lastEditedBy"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
});

// Full canvas snapshots for undo/revert — stores JSON of all nodes + strokes
export const canvasSnapshots = pgTable("canvas_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").default("auto"), // "auto", "clear", "manual"
  nodesJson: text("nodesJson").notNull(), // JSON array of all canvas_nodes
  strokesJson: text("strokesJson").notNull(), // JSON array of all canvas_strokes
  createdBy: text("createdBy"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
});

export const canvasStrokes = pgTable("canvas_strokes", {
  id: uuid("id").defaultRandom().primaryKey(),
  points: text("points").notNull(), // JSON array of {x,y} points
  color: text("color").default("#000000"),
  width: integer("width").default(2),
  createdBy: text("createdBy"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("userId").notNull(), // email of the user to notify
  type: text("type").notNull(), // "task_assigned" | "task_updated"
  title: text("title").notNull(),
  sourceId: text("sourceId"), // canvas node id or goal id
  sourcePage: text("sourcePage"), // "technical" | "company" etc
  fromUser: text("fromUser"), // who triggered it
  read: boolean("read").default(false),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("userId").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp", { mode: "date" }).defaultNow(),
});
