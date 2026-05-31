import { FROM_EMAIL, resend } from "@/lib/email";
import type { Locale } from "@/lib/i18n/config";
import { TeamLoginEmail } from "@/emails/team-login";

type SendInput = {
  to: string;
  url: string;
  teamCode: string;
  teamName: string;
  locale: Locale;
  expiresAt: Date;
};

export async function sendLoginMagicLink(input: SendInput) {
  if (!resend) {
    return { sent: false as const, devUrl: input.url };
  }

  const { subject, text } = renderEmail(input);
  const minutes = Math.max(1, Math.round((input.expiresAt.getTime() - Date.now()) / 60000));

  await resend.emails.send({
    from: FROM_EMAIL,
    to: input.to,
    subject,
    // Branded HTML, with the plain text kept as a fallback for clients
    // that don't render HTML.
    react: TeamLoginEmail({
      teamName: input.teamName,
      teamCode: input.teamCode,
      url: input.url,
      minutes,
      locale: input.locale,
    }),
    text,
  });

  return { sent: true as const };
}

function renderEmail({ url, teamCode, teamName, locale, expiresAt }: SendInput) {
  const minutes = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60000));

  if (locale === "pl") {
    return {
      subject: `Twój link logowania dla ${teamName}`,
      text:
        `Kliknij ten link, aby otworzyć panel drużyny ${teamName} (${teamCode}):\n\n${url}\n\n` +
        `Link jest jednorazowy i wygasa za ${minutes} minut. Jeśli to nie Ty prosiłeś o ten link, zignoruj tę wiadomość.`,
    };
  }

  if (locale === "ua") {
    return {
      subject: `Твоє посилання для входу в команду ${teamName}`,
      text:
        `Натисни це посилання, щоб відкрити панель команди ${teamName} (${teamCode}):\n\n${url}\n\n` +
        `Посилання одноразове та діє ${minutes} хв. Якщо ти не запитував його, просто проігноруй цей лист.`,
    };
  }

  return {
    subject: `Your team dashboard link for ${teamName}`,
    text:
      `Click this link to open the dashboard for ${teamName} (${teamCode}):\n\n${url}\n\n` +
      `The link is single-use and expires in ${minutes} minutes. If you did not request it, ignore this email.`,
  };
}
