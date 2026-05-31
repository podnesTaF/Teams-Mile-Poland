import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const inquiryStatusEnum = pgEnum("inquiry_status", ["new", "handled"]);

// Contact-form submissions from the landing page. Surfaced + managed in /admin.
export const contactInquiries = pgTable("contact_inquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  message: text("message"),
  method: text("method").notNull(),
  status: inquiryStatusEnum("status").default("new").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
