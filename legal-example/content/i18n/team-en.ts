import type { DocumentContent, InternalDocumentMeta } from "../types";
import type { DocumentSlug, InternalDocSlug } from "@/lib/types";

export const teamDocumentsEn: Record<"team-oswiadczenie" | "team-regulations" | "team-rules" | "team-rodo", DocumentContent> = {
  "team-oswiadczenie": {
    slug: "team-oswiadczenie",
    kicker: "Main document",
    title: "Participant Statement",
    eventLine: "For the event: {event}",
    intro: [
      "This form applies to the ACE BATTLE RUN – TEAM MILE POLAND – TEAM–Individual Ranking series (team-individual format). You confirm your details, that you are of age and fit to take part, accept the typical risks of the race, and provide your team name and assigned role (RACER / ACE / JOKER).",
      "Fill in every field marked with a star and tick the required consents.",
    ],
    officialDocLabel: "Full text of the Participant Statement",
    fields: [
      {
        name: "fullName",
        label: "Participant's full name",
        placeholder: "Jan Kowalski",
        required: true,
        type: "text",
      },
      {
        name: "birthDate",
        label: "Date of birth",
        required: true,
        type: "date",
        helpText: "Needed to confirm you are 18 or older.",
      },
      {
        name: "phoneOrEmail",
        label: "Phone and / or e-mail",
        placeholder: "+48 500 000 000 or jan@example.com",
        required: true,
        type: "text",
      },
      {
        name: "emergencyContact",
        label: "Emergency contact (name and phone)",
        placeholder: "Anna Kowalska, +48 500 111 222",
        required: true,
        type: "text",
      },
      {
        name: "address",
        label: "Home address",
        required: false,
        type: "text",
        helpText: "Optional — never published with the results.",
      },
      {
        name: "teamName",
        label: "Team name",
        placeholder: "e.g. Warsaw Runners",
        required: true,
        type: "text",
        helpText: "Per § 3 of the Regulations — must include the region name.",
      },
      {
        name: "teamRole",
        label: "Role in the team race",
        required: true,
        type: "select",
        options: ["RACER", "ACE", "JOKER"],
        placeholder: "Select a role",
        helpText: "Final roles are confirmed during Check-in.",
      },
      {
        name: "bankAccount",
        label: "Bank account number",
        required: false,
        type: "text",
        conditional: "prizeWinner",
        helpText:
          "Fill in only if your team finishes in a prize position (Appendix 3). Not required for regular registration.",
      },
      {
        name: "taxId",
        label: "National ID (PESEL) or Tax ID (NIP), for prize taxation",
        required: false,
        type: "text",
        conditional: "prizeWinner",
        helpText:
          "Required only for a cash prize exceeding PLN 2,000 per person.",
      },
    ],
    checkboxes: [
      {
        id: "ageAndHealth",
        required: true,
        label:
          "I declare that on the day of the event I am 18 years of age or older, I take part voluntarily, and my health allows me to safely take part.",
      },
      {
        id: "risks",
        required: true,
        label:
          "I understand and knowingly accept the typical risks of taking part in a running competition (falls, collisions, dehydration, injuries and others).",
      },
      {
        id: "rulesAndRegulations",
        required: true,
        label:
          'I have read the Public Regulations and the Team Mile Rules ("ACE BATTLE RUN – Team Mile Rules") and I agree to comply with them.',
      },
      {
        id: "rodoRead",
        required: true,
        label:
          "I have received, or had the opportunity to read, the GDPR Information Clause for participants of this event series.",
      },
      {
        id: "publicResults",
        required: true,
        label:
          "I have been informed that my name, surname, time, ranking position, sport category and team name may be published publicly on the event website.",
      },
      {
        id: "prizeDataUnderstanding",
        required: true,
        label:
          "I understand that if my team finishes in a prize position, payout of the prize requires providing bank transfer details and, where necessary, tax data (Appendix 3).",
      },
    ],
    imageConsent: {
      question: "Image, photos and recordings — separate voluntary consent",
      agreeLabel:
        "I AGREE to the use and dissemination of my individually recognizable image captured during the event in the Organizer's informational, reporting and promotional materials, without separate remuneration. I may withdraw this consent for the future at any time.",
      agreeNote: "Voluntary consent — you can withdraw it at any time.",
      disagreeLabel:
        "I DO NOT CONSENT to the use of my individually recognizable image on the basis of voluntary consent.",
      disagreeNote:
        "Declining does not affect your right to take part in the event.",
    },
    submitLabel: "Sign and submit the statement",
    submittingLabel: "Submitting…",
    successTitle: "Thank you — your statement has been recorded",
    successBody:
      "Your confirmation has been recorded together with the date, time and IP address. See you at the start!",
    requiredNotice:
      "We cannot admit you to the start line without the required consents.",
  },

  "team-regulations": {
    slug: "team-regulations",
    kicker: "Legal document",
    title: "Public Regulations (TEAM MILE POLAND)",
    eventLine: "For the event: {event}",
    intro: [
      "Public Regulations of the ACE BATTLE RUN – TEAM MILE POLAND – TEAM–Individual Ranking national ranking competition. Covers registration, Check-in, the conduct of races, timing, protests and appeals, categories and the prize pool, and personal data protection.",
      "Supplemented by Appendices 1–5 (schedules, categories and prize pool, ranking criteria) — available from the Organizer.",
    ],
    officialDocLabel: "Full text of the Public Regulations",
    fields: [],
    checkboxes: [
      {
        id: "acceptRegulations",
        required: true,
        label:
          "I have read the full text of the Public Regulations of the TEAM MILE POLAND series and I accept its provisions.",
      },
    ],
    submitLabel: "Confirm acceptance",
    submittingLabel: "Saving…",
    successTitle: "Regulations accepted",
    successBody: "Your confirmation has been saved. Thank you!",
    requiredNotice:
      "Accepting the Regulations is a condition for being admitted to the event.",
  },

  "team-rules": {
    slug: "team-rules",
    kicker: "Technical document",
    title: "Team Mile Rules",
    eventLine: "For the event: {event}",
    intro: [
      "Describes participant roles (RACER, ACE, JOKER), team composition and types, the AB MACE handover rules in the JOKER ZONE, race and timing rules, and how team and individual results are determined.",
      "Worth reading in full before Check-in — it includes the exact rules for role assignment and distance stages.",
    ],
    officialDocLabel: "Full text of the Team Mile Rules",
    fields: [],
    checkboxes: [
      {
        id: "acceptRules",
        required: true,
        label:
          "I have read the ACE BATTLE RUN — Team Mile Rules and I agree to comply with them.",
      },
    ],
    submitLabel: "Confirm acceptance",
    submittingLabel: "Saving…",
    successTitle: "Rules accepted",
    successBody: "Your confirmation has been saved. Thank you!",
    requiredNotice:
      "Accepting the Rules is a condition for being admitted to the event.",
  },

  "team-rodo": {
    slug: "team-rodo",
    kicker: "Data protection",
    title: "GDPR Information Clause (Document No. 6)",
    eventLine: "For the event: {event}",
    intro: [
      "The controller of your personal data is ACE BATTLE POLAND Sp. z o.o. We process your data to run the registration, hold the event, measure time and establish results, ensure safety, and handle protests — on the basis of Art. 6(1)(b), (c) and (f) GDPR.",
      "In the public results table we publish only: first name, surname, time, ranking position, sport category and team name. We do not publish national ID numbers, date of birth, address, phone, e-mail or emergency-contact details.",
    ],
    officialDocLabel: "Full text of the GDPR Information Clause",
    fields: [],
    checkboxes: [
      {
        id: "acceptRodo",
        required: true,
        label:
          "I confirm that I have read the GDPR Information Clause for participants of this event series.",
      },
    ],
    submitLabel: "Confirm you have read it",
    submittingLabel: "Saving…",
    successTitle: "Confirmation saved",
    successBody: "Thank you for reviewing our data-protection information.",
    requiredNotice:
      "This is the controller's statutory information duty — confirming you have read it is required before registration.",
  },
};

export const teamInternalDocumentsEn: Record<
  | "team-lia"
  | "team-potwierdzenie"
  | "team-captain"
  | "team-appendix1"
  | "team-appendix2"
  | "team-appendix3"
  | "team-appendix4"
  | "team-appendix5",
  InternalDocumentMeta
> = {
  "team-lia": {
    slug: "team-lia",
    kicker: "Internal document",
    title: "Balance Test / LIA (Document No. 7) — TEAM MILE POLAND",
    intro: [
      "The Organizer's internal analytical document justifying the publication of results on the basis of legitimate interest (Art. 6(1)(f) GDPR), common to the entire TEAM MILE POLAND series.",
    ],
    internalNotice:
      "Internal document — visible to administrators and managers only.",
  },
  "team-potwierdzenie": {
    slug: "team-potwierdzenie",
    kicker: "Internal document",
    title: "Acknowledging the Application of the LIA — TEAM MILE POLAND",
    intro: [
      "The Administrator (not the participant) confirms that the applicable Balance Test / LIA has been applied to a specific edition of the TEAM MILE POLAND series.",
    ],
    internalNotice:
      "Internal document — the administrator confirms it on their own before each edition.",
  },
  "team-captain": {
    slug: "team-captain",
    kicker: "Internal document",
    title: "Provisions on the Team Captain in the ACE BATTLE RUN Ecosystem",
    intro: [
      "Sets out the status, powers and duties of the Team Captain. Applies only to the person performing that role within a given team — it is not a document signed by every participant at registration.",
    ],
    internalNotice:
      "Reference document — made available to Team Captains and visible in the admin panel; not part of the standard participant consent set.",
  },
  "team-appendix1": {
    slug: "team-appendix1",
    kicker: "Appendix 1",
    title: "Event Schedule for Participants",
    intro: [
      "Detailed timeline of the start day: registration, Check-in, Call Room assembly, starts every 15 minutes, publication of results.",
    ],
    internalNotice: "Reference document — available in the admin panel and on participant request.",
  },
  "team-appendix2": {
    slug: "team-appendix2",
    kicker: "Appendix 2",
    title: "Event Schedule for Organizers",
    intro: [
      "Internal timeline of organizational and refereeing staff actions on the day of the event.",
    ],
    internalNotice: "Internal document — for the organizational team only.",
  },
  "team-appendix3": {
    slug: "team-appendix3",
    kicker: "Appendix 3",
    title: "Categories and Prize Pool",
    intro: [
      "The series prize pool (PLN 10,000), category breakdown (men's/women's/MIX teams, individual classification) and prize payout conditions.",
    ],
    internalNotice: "Reference document — available in the admin panel and on participant request.",
  },
  "team-appendix4": {
    slug: "team-appendix4",
    kicker: "Appendix 4",
    title: "Individual Ranking Criteria",
    intro: [
      "Table of 16 individual levels (INDIVIDUAL LEVEL) broken down by gender and role (RUNNERS / ACE & JOKER), used to determine a participant's level in the ACE BATTLE RUN RATING system.",
    ],
    internalNotice: "Reference document — available in the admin panel and on participant request.",
  },
  "team-appendix5": {
    slug: "team-appendix5",
    kicker: "Appendix 5",
    title: "Team Ranking Criteria",
    intro: [
      "Table of team divisions (BEGINNER → TOP ELITE) with time thresholds for each category.",
    ],
    internalNotice: "Reference document — available in the admin panel and on participant request.",
  },
};

export const registerTeamEn: DocumentContent = {
  slug: "team-oswiadczenie",
  kicker: "Registration",
  title: "Register your team / join a race",
  eventLine: "ACE BATTLE RUN – TEAM MILE POLAND – TEAM–Individual Ranking",
  intro: [],
  officialDocLabel: "Read the full documents",
  fields: teamDocumentsEn["team-oswiadczenie"]!.fields,
  checkboxes: [
    {
      id: "rulesAndRegulations",
      required: true,
      label:
        "I have read the Public Regulations and the Team Mile Rules (TEAM MILE) and I agree to comply with them.",
    },
    {
      id: "ageHealthRisks",
      required: true,
      label:
        "I declare that on the day of the event I am 18 years of age or older, I take part voluntarily, and my health allows me to safely take part — and I knowingly accept the typical risks of a team race.",
    },
    {
      id: "dataTruthfulAndRodo",
      required: true,
      label:
        "I confirm that the details I have provided, including my team name and role, are true, and I have read the GDPR Information Clause for this event series.",
    },
    {
      id: "publicResultsAwareness",
      required: true,
      label:
        "I understand that my name, surname, time, ranking position, sport category and team name may be published publicly, while my contact details, address and date of birth are NOT published.",
    },
    {
      id: "prizeDataUnderstanding",
      required: true,
      label:
        "I understand that if my team finishes in a prize position, payout of the prize requires providing bank transfer details and, where necessary, tax data (Appendix 3).",
    },
  ],
  imageConsent: teamDocumentsEn["team-oswiadczenie"]!.imageConsent,
  submitLabel: "Complete registration →",
  submittingLabel: "Registering…",
  successTitle: "Registration complete!",
  successBody:
    "Your submission and signed documents have been saved. See you at the start!",
  requiredNotice:
    "We cannot admit you to the start line without the required consents.",
};
