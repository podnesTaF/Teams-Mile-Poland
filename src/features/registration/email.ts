import { FROM_EMAIL, resend } from "@/lib/email";

import { createMagicLink, type StoredRegistration } from "./data";

type EmailInput = {
  stored: StoredRegistration;
  dashboardPath?: string;
};

export async function sendRegistrationEmails({ stored, dashboardPath }: EmailInput) {
  const magicUrl = await createMagicLink({
    email: stored.runnerEmail,
    runnerId: stored.runnerId,
    teamId: stored.teamId,
    path: dashboardPath,
  });

  if (!resend) {
    return { magicUrl };
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: stored.runnerEmail,
    subject: subjectForFlow(stored),
    text: runnerEmailText(stored, magicUrl),
  });

  if (stored.flow === "join" && stored.captainEmail) {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: stored.captainEmail,
      subject: "A runner joined your TEAMS MILE squad",
      text: `A new runner joined your team ${stored.teamCode ?? ""}.\n\nOpen your dashboard: ${magicUrl}`,
    });
  }

  return { magicUrl };
}

function subjectForFlow(stored: StoredRegistration) {
  if (stored.flow === "start") return "Your TEAMS MILE team code";
  if (stored.flow === "free") return "You are registered as a free runner";
  if (stored.flow === "solo") return "Your solo rating mile registration";
  return "Your TEAMS MILE registration is confirmed";
}

function runnerEmailText(stored: StoredRegistration, magicUrl: string) {
  const paymentLine =
    stored.paymentStatus === "free"
      ? "You claimed one of the first 300 free runner slots."
      : "Your 50 PLN registration payment is confirmed.";

  if (stored.flow === "start") {
    return `Your team is live.\n\nTeam code: ${stored.teamCode}\nInvite link: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/join/${stored.teamCode}\n\n${paymentLine}\n\nDashboard: ${magicUrl}`;
  }

  if (stored.flow === "free") {
    return `You are registered as a free runner and pending assignment.\n\n${paymentLine}\n\nWe will email you when the organizer proposes a team.\nDashboard: ${magicUrl}`;
  }

  if (stored.flow === "solo") {
    return `Your solo rating mile registration is confirmed.\n\n${paymentLine}\n\nYour individual start block is 10:30-12:00.\nDashboard: ${magicUrl}`;
  }

  return `You are confirmed for ${stored.teamCode ?? "your team"}.\n\n${paymentLine}\n\nDashboard: ${magicUrl}`;
}
