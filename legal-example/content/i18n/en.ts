import type { CommonDictionary } from "../types";
import { teamDocumentsEn, teamInternalDocumentsEn, registerTeamEn } from "./team-en";

export const en: CommonDictionary = {
  localeName: "English",
  siteName: "ACE BATTLE RUN — Warsaw",
  nav: {
    home: "Home",
    register: "Register for the race",
    documents: "Participant documents",
    terms: "Terms & Privacy",
    contact: "Contact",
  },
  hub: {
    kicker: "Before the start",
    title: "Participant documents",
    subtitle:
      "Before you step on the start line, please confirm the documents below. It takes about 5 minutes — the event details (date, venue) are filled in automatically.",
    cardCta: "Open and sign →",
  },
  eventCard: {
    label: "This form applies to",
    dateLabel: "Date",
    venueLabel: "Venue",
    entryLabel: "Entry",
    entryFree: "Free",
    statusOpen: "Registration open",
    statusSoon: "Coming soon",
    statusClosed: "Registration closed",
    statusFinished: "Finished",
    switchEvent: "Wrong edition? Choose another",
  },
  form: {
    requiredMark: "Fields marked * are required",
    requiredHint: "required",
    readFullDocument: "Full document text",
    readFullDocumentCta: "Open full text →",
    fallbackNotice:
      "A translation into this language isn't available yet — showing the Polish version below.",
    errorRequired: "This field is required.",
    errorGeneric: "Please check the highlighted fields and try again.",
    backToDocuments: "← All documents",
    backToForm: "← Back to the form",
    print: "Print",
  },
  footer: {
    rights: "All rights reserved.",
    organizer: "Organizer: ACE BATTLE POLAND Sp. z o.o., Warsaw",
    termsLink: "Privacy Policy & Terms of Use",
  },
  documents: {
    oswiadczenie: {
      slug: "oswiadczenie",
      kicker: "Main document",
      title: "Participant Statement",
      eventLine: "For the event: {event}",
      intro: [
        "This is the most important form before the start: you confirm your details, that you are of age and fit to take part, you knowingly accept the typical risks of a street race, and you review how results are published.",
        "Fill in every field marked with a star and tick the required consents. The other checkboxes cover situations that may not apply to you (e.g. prize-payout data) — tick them if you understand and accept them.",
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
          name: "bankAccount",
          label: "Bank account number",
          required: false,
          type: "text",
          conditional: "prizeWinner",
          helpText:
            "Fill in only if you finish in a prize position (§ 7A of the Rules). Not required for regular registration.",
        },
        {
          name: "taxId",
          label: "National ID (PESEL) or Tax ID (NIP), for prize taxation",
          required: false,
          type: "text",
          conditional: "prizeWinner",
          helpText:
            "Required only for a cash prize exceeding PLN 2,000, per Art. 30(1)(2) of the Polish PIT Act.",
        },
      ],
      checkboxes: [
        {
          id: "ageAndHealth",
          required: true,
          label:
            "I declare that on the day of the event I am 18 years of age or older, I take part voluntarily, and to the best of my knowledge my health allows me to safely take part in the race.",
        },
        {
          id: "risks",
          required: true,
          label:
            "I understand and knowingly accept the typical risks of taking part in a running competition (falls, collisions, slipping, dehydration, muscle and joint injuries, adverse weather and others), to the extent not caused by the Organizer's fault.",
        },
        {
          id: "rulesAndInstructions",
          required: true,
          label:
            'I have read the event rules ("Public Regulations for the National Individual Ranking Mile") or had a genuine opportunity to do so, and I agree to follow the course and the instructions of the Organizer, judges and services.',
        },
        {
          id: "rodoRead",
          required: true,
          label:
            "I have received, or had the opportunity to read, the GDPR Information Clause for event participants.",
        },
        {
          id: "publicResults",
          required: true,
          label:
            "I have been informed that my name, surname, finishing time, ranking position and sport category may be published publicly on the event website, without any login required.",
        },
        {
          id: "sensitiveDataNotPublished",
          required: true,
          label:
            "I understand that my contact details, address, date of birth, emergency contact and health information are NOT intended for publication in the results table.",
        },
        {
          id: "prizeDataUnderstanding",
          required: true,
          label:
            "I understand that if I finish in a prize position, payout of the prize requires providing bank transfer details and, where necessary, tax data (see § 7A of the Rules).",
        },
        {
          id: "accuracyOfData",
          required: true,
          label:
            "I confirm that the details I have provided are true and that my participation in the event is voluntary.",
        },
      ],
      imageConsent: {
        question: "Image, photos and recordings — separate voluntary consent",
        agreeLabel:
          "I AGREE to the use and dissemination of my individually recognizable image captured during the event in the Organizer's informational, reporting and promotional materials (website, social media), without separate remuneration. I may withdraw this consent for the future at any time.",
        agreeNote: "Voluntary consent — you can withdraw it at any time.",
        disagreeLabel:
          "I DO NOT CONSENT to the use of my individually recognizable image on the basis of voluntary consent.",
        disagreeNote:
          "Declining does not affect your right to take part in the event. The image of a person who is merely a detail of a wider whole (e.g. a crowd at a public event) may be disseminated without separate consent under Art. 81 of the Polish Act on Copyright and Related Rights.",
      },
      submitLabel: "Sign and submit the statement",
      submittingLabel: "Submitting…",
      successTitle: "Thank you — your statement has been recorded",
      successBody:
        "Your confirmation has been recorded together with the date, time and IP address as proof of submission. See you at the start!",
      requiredNotice:
        "We cannot admit you to the start line without the required consents.",
    },
    przepisy: {
      slug: "przepisy",
      kicker: "Technical document",
      title: "Public Regulations for the National Individual Ranking Mile",
      eventLine: "For the event: {event}",
      intro: [
        "This document describes how the competition is run: registration and check-in, the race-day schedule, start heats, race and timing rules, classification categories, the protest procedure, and details of the prize fund.",
        "Worth reading in full before the start — it includes the exact registration-closing times and disqualification rules.",
      ],
      officialDocLabel: "Full text of the Public Regulations",
      fields: [
        {
          name: "fullName",
          label: "Participant's full name",
          placeholder: "Jan Kowalski",
          required: true,
          type: "text",
        },
      ],
      checkboxes: [
        {
          id: "acceptPrzepisy",
          required: true,
          label:
            "I have read the Public Regulations for the National Individual Ranking Mile and I agree to comply with them.",
        },
      ],
      submitLabel: "Confirm acceptance",
      submittingLabel: "Saving…",
      successTitle: "Regulations accepted",
      successBody: "Your confirmation has been saved. Thank you!",
      requiredNotice:
        "Accepting the Regulations is a condition for being admitted to the event.",
    },
    rodo: {
      slug: "rodo",
      kicker: "Data protection",
      title: "GDPR Information Clause for Event Participants",
      eventLine: "For the event: {event}",
      intro: [
        "The controller of your personal data is ACE BATTLE POLAND Sp. z o.o. We process your data to run the registration, hold the event, measure time and establish results, ensure safety, and handle protests — on the basis of Art. 6(1)(b), (c) and (f) GDPR.",
        "In the public results table we publish only: first name, surname, finishing time, ranking position and sport category. We do not publish national ID numbers, date of birth, address, phone, e-mail, emergency-contact details or health information.",
        "You have the right to access your data, rectify it, erase it, restrict its processing, object to processing (Art. 21 GDPR), and lodge a complaint with the President of the Polish Data Protection Authority (UODO).",
      ],
      officialDocLabel: "Full text of the GDPR Information Clause",
      fields: [
        {
          name: "fullName",
          label: "Participant's full name",
          placeholder: "Jan Kowalski",
          required: true,
          type: "text",
        },
      ],
      checkboxes: [
        {
          id: "acceptRodo",
          required: true,
          label:
            "I confirm that I have read the GDPR Information Clause for event participants.",
        },
      ],
      submitLabel: "Confirm you have read it",
      submittingLabel: "Saving…",
      successTitle: "Confirmation saved",
      successBody: "Thank you for reviewing our data-protection information.",
      requiredNotice:
        "This is the controller's statutory information duty — confirming you have read it is required before registration.",
    },
    ...teamDocumentsEn,
  },
  register: {
    slug: "oswiadczenie",
    kicker: "Registration",
    title: "Register for the race",
    eventLine: "One mile. One result. Your level.",
    intro: [],
    officialDocLabel: "Read the full documents",
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
        name: "bankAccount",
        label: "Bank account number",
        required: false,
        type: "text",
        conditional: "prizeWinner",
        helpText:
          "Fill in only if you finish in a prize position (§ 7A of the Rules). Not required for regular registration.",
      },
      {
        name: "taxId",
        label: "National ID (PESEL) or Tax ID (NIP), for prize taxation",
        required: false,
        type: "text",
        conditional: "prizeWinner",
        helpText:
          "Required only for a cash prize exceeding PLN 2,000, per Art. 30(1)(2) of the Polish PIT Act.",
      },
    ],
    checkboxes: [
      {
        id: "rulesAndRegulations",
        required: true,
        label:
          'I have read the event rules ("Public Regulations") and I agree to follow the course and the instructions of the Organizer, judges and safety services.',
      },
      {
        id: "ageHealthRisks",
        required: true,
        label:
          "I declare that on the day of the event I am 18 years of age or older, I take part voluntarily, and my health allows me to safely take part — and I knowingly accept the typical risks of a street race (falls, collisions, dehydration, injuries and others).",
      },
      {
        id: "dataTruthfulAndRodo",
        required: true,
        label:
          "I confirm that the details I have provided are true, and I have read the GDPR Information Clause for event participants.",
      },
      {
        id: "publicResultsAwareness",
        required: true,
        label:
          "I understand that my name, surname, finishing time, ranking position and sport category may be published publicly, while my contact details, address, date of birth and health information are NOT published.",
      },
      {
        id: "prizeDataUnderstanding",
        required: true,
        label:
          "I understand that if I finish in a prize position, payout of the prize requires providing bank transfer details and, where necessary, tax data (§ 7A of the Rules).",
      },
    ],
    imageConsent: {
      question: "Image, photos and recordings — separate voluntary consent",
      agreeLabel:
        "I AGREE to the use and dissemination of my individually recognizable image captured during the event in the Organizer's informational, reporting and promotional materials (website, social media), without separate remuneration. I may withdraw this consent for the future at any time.",
      agreeNote: "Voluntary consent — you can withdraw it at any time.",
      disagreeLabel:
        "I DO NOT CONSENT to the use of my individually recognizable image on the basis of voluntary consent.",
      disagreeNote:
        "Declining does not affect your right to take part in the event. The image of a person who is merely a detail of a wider whole (e.g. a crowd at a public event) may be disseminated without separate consent under Art. 81 of the Polish Act on Copyright and Related Rights.",
    },
    submitLabel: "Complete registration →",
    submittingLabel: "Registering…",
    successTitle: "Registration complete!",
    successBody:
      "Your submission and signed documents have been saved. See you at the start!",
    requiredNotice:
      "We cannot admit you to the start line without the required consents.",
  },
  registerTeam: registerTeamEn,
  internalDocuments: {
    regulamin: {
      slug: "regulamin",
      kicker: "Internal document",
      title: "Sporting Event Rules",
      intro: [
        "The overarching legal document for the Ace Battle Run Poland — One Mile Qualification series. Its provisions concerning participants (conditions of participation, GDPR, image rights, the prize fund § 7A, liability) are already fully reflected in the \"Public Regulations\", which the participant signs at registration — so this document is not shown separately on the participant form.",
        "Kept here as a reference document in case of an audit, dispute, or when updating the Public Regulations.",
      ],
      internalNotice:
        "Internal document — visible to administrators and managers only. Participants never see it and sign nothing in it.",
    },
    lia: {
      slug: "lia",
      kicker: "Internal document",
      title:
        "Balance Test / Legitimate Interest Assessment (LIA) — Public Disclosure of Results",
      intro: [
        "The Organizer's internal analytical document explaining why the public publication of competition results (name, surname, time, ranking) is based on the Organizer's legitimate interest (Art. 6(1)(f) GDPR) rather than the participant's consent.",
        "A document common to the entire 2026 event series — not tied to a single edition.",
      ],
      internalNotice:
        "Internal document — visible to administrators and managers only. It is not, and should not be, shown to participants.",
    },
    potwierdzenie: {
      slug: "potwierdzenie",
      kicker: "Internal document",
      title: "Acknowledging the Application of the LIA to the Event",
      intro: [
        "A short form by which the administrator (not the participant) confirms that the applicable Balance Test / LIA has been applied to a specific event edition, and that the way results are published complies with it.",
        "Completed and archived internally for every edition of the series.",
      ],
      internalNotice:
        "Internal document — the administrator confirms it on their own before each edition. The participant has no contact with it.",
    },
    ...teamInternalDocumentsEn,
  },
};
