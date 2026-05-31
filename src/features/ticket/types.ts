import type { StoredRegistration } from "@/features/registration/data";

export type TicketFlow = StoredRegistration["flow"];

export type TicketView = {
  runnerId: string;
  fullName: string;
  email: string;
  phone: string;
  teamCode?: string;
  teamName?: string;
  flow: TicketFlow;
  paymentStatus: "free" | "paid";
  eventName: string;
  eventDateLabel: string;
  eventVenue: string;
  checkedInAt?: Date | null;
};
