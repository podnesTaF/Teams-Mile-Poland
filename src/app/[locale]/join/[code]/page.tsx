import { setRequestLocale } from "next-intl/server";

import { Footer } from "@/components/marketing/footer";
import { Header } from "@/components/marketing/header";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { RegistrationForm } from "@/features/registration/components/registration-form";
import { RegistrationShell } from "@/features/registration/components/registration-shell";
import { getRegistrationCounters, validateJoinCode } from "@/features/registration/data";
import { normalizeTeamCode } from "@/features/registration/schemas";

export default async function JoinCodePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const counters = await getRegistrationCounters();
  const normalizedCode = normalizeTeamCode(decodeURIComponent(code));
  const validation = await safeValidate(normalizedCode);

  return (
    <>
      <Header remaining={counters.freeSlotsRemaining} total={counters.freeSlotsTotal} />
      {validation.ok ? (
        <RegistrationShell
          title={`Join ${validation.team.name}.`}
          intro="Confirm your details to join this team."
          counters={counters}
          raceBlock="Team mile"
          raceNote="Captain notified after registration."
          team={validation.team}
        >
          <RegistrationForm flow="join" teamCode={normalizedCode} />
        </RegistrationShell>
      ) : (
        <main className="bg-bg-2 py-8 md:py-12">
          <Container className="max-w-2xl">
            <section className="border border-ink bg-bg p-5 md:p-7">
              <span className="eyebrow eyebrow-red">Team code problem</span>
              <h1 className="shout shout-md mt-3">Can&apos;t join yet.</h1>
              <p className="mt-4 text-muted">{validation.message}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <LinkButton href="/join" intent="primary">
                  Try another code
                </LinkButton>
                <LinkButton href="/#register" intent="ghost">
                  Pick another path
                </LinkButton>
              </div>
            </section>
          </Container>
        </main>
      )}
      <Footer />
    </>
  );
}

async function safeValidate(code: string) {
  try {
    return await validateJoinCode(code);
  } catch {
    return {
      ok: false as const,
      reason: "missing" as const,
      message: "We could not validate that code right now. Try again in a moment.",
    };
  }
}
