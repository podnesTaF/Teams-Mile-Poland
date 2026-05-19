import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations("registration.join");

  return (
    <>
      <Header remaining={counters.freeSlotsRemaining} total={counters.freeSlotsTotal} />
      {validation.ok ? (
        <RegistrationShell
          title={t("title", { team: validation.team.name })}
          intro={t("intro")}
          counters={counters}
          raceBlock={t("block")}
          raceNote={t("note")}
          team={validation.team}
        >
          <RegistrationForm flow="join" teamCode={normalizedCode} />
        </RegistrationShell>
      ) : (
        <main className="bg-bg-2 py-8 md:py-12">
          <Container className="max-w-2xl">
            <section className="border border-ink bg-bg p-5 md:p-7">
              <span className="eyebrow eyebrow-red">{t("problem")}</span>
              <h1 className="shout shout-md mt-3">{t("cannotJoin")}</h1>
              <p className="mt-4 text-muted">{validation.message}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <LinkButton href="/join" intent="primary">
                  {t("tryAnother")}
                </LinkButton>
                <LinkButton href="/#register" intent="ghost">
                  {t("pickAnother")}
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
