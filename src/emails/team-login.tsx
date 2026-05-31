import { Text } from "@react-email/components";

import type { Locale } from "@/lib/i18n/config";

import { Btn, C, EmailShell, HeroBand, Rule, SectionPad } from "./components";

type Props = {
  teamName: string;
  teamCode: string;
  url: string;
  minutes: number;
  locale: Locale;
};

const COPY = {
  en: {
    preview: "Your team dashboard sign-in link",
    eyebrow: "Team dashboard",
    title: "Sign in to your team",
    intro: (team: string) => `Use the button below to open the dashboard for ${team}.`,
    cta: "Open dashboard",
    expiry: (m: number) =>
      `This link is single-use and expires in ${m} minutes. If you did not request it, ignore this email.`,
  },
  pl: {
    preview: "Twój link logowania do panelu drużyny",
    eyebrow: "Panel drużyny",
    title: "Zaloguj się do drużyny",
    intro: (team: string) => `Kliknij przycisk poniżej, aby otworzyć panel drużyny ${team}.`,
    cta: "Otwórz panel",
    expiry: (m: number) =>
      `Link jest jednorazowy i wygasa za ${m} minut. Jeśli to nie Ty prosiłeś o link, zignoruj tę wiadomość.`,
  },
  ua: {
    preview: "Твоє посилання для входу в панель команди",
    eyebrow: "Панель команди",
    title: "Увійди до своєї команди",
    intro: (team: string) => `Натисни кнопку нижче, щоб відкрити панель команди ${team}.`,
    cta: "Відкрити панель",
    expiry: (m: number) =>
      `Посилання одноразове та діє ${m} хв. Якщо ти не запитував його, просто проігноруй цей лист.`,
  },
} as const;

export function TeamLoginEmail({ teamName, teamCode, url, minutes, locale }: Props) {
  const c = COPY[locale] ?? COPY.en;
  return (
    <EmailShell preview={c.preview}>
      <HeroBand eyebrow={c.eyebrow} title={c.title} sub={`${teamName} · ${teamCode}`} />
      <SectionPad>
        <Text style={{ margin: "0 0 18px", fontSize: "15px", lineHeight: "1.5", color: C.text }}>
          {c.intro(teamName)}
        </Text>
        <Btn href={url}>{c.cta}</Btn>
      </SectionPad>
      <Rule />
      <SectionPad soft>
        <Text style={{ margin: 0, fontSize: "12px", lineHeight: "1.6", color: C.muted }}>
          {c.expiry(minutes)}
        </Text>
      </SectionPad>
    </EmailShell>
  );
}

export default TeamLoginEmail;
