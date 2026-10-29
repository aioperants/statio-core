"use client";
import { Avatar } from "@/components/avatar";
import { PhoneInput } from "@/components/phone-input";
import { AddToCalendar } from "@/components/add-to-calendar";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { authClient, inIframe, onSignedInElsewhere } from "@/lib/auth-client";
import { dayLabel, hhmm, money } from "@/lib/format";
import { heardLabel } from "@/lib/heard";
import { addDays } from "@/lib/time";
import { recommendedStarts } from "@/lib/slots";
import { fetchSlots, nextFree, placeBooking, type BookResult } from "./actions";
import { Turnstile } from "@/components/turnstile";
import { Sparkle } from "@/components/icons";

interface Service {
  id: string;
  name: string;
  category: string | null;
  durationMin: number;
  priceCents: number;
  /** Clients confirm a patch test / allergy check for it. */
  needsConsent: boolean;
}
interface Person {
  id: string;
  name: string;
  color: string;
  photo: string | null;
  title: string | null;
  jobTitle: string | null;
  slug: string;
  serviceIds: string[];
  /** Their own duration per service, where it differs. */
  durations: Record<string, number>;
}
interface Props {
  locale: string;
  currency: string;
  today: string;
  horizonDays: number;
  /** Days the salon is closed (no opening hours that weekday, or a closed day/holiday): left out of the day strip. */
  closedDays: string[];
  turnstileSiteKey: string | null;
  services: Service[];
  staff: Person[];
  user: { email: string; name: string; phone: string } | null;
  /** Optional questions for a first booking: where they heard about us (the options), and their town. */
  questions: { heard: string[] | null; city: boolean } | null;
  /** The salon's country: the starting country code for the phone number. */
  country: string | null;
  /** Free cancellation up to this many hours before; and the address, for the summary. */
  cancellationHours: number;
  address: string | null;
  /** A returning client's last visit, to book the same again. */
  again: { serviceIds: string[]; staffId: string | null } | null;
  /** Opened from a professional's own link: start with them. */
  startWith: string | null;
  /** Opened from "Book this" on the salon's website: start with this service picked. */
  startService?: string | null;
  /** Put the times that fill the salon's day on top ("Recommended"). */
  recommend: boolean;
  /** The salon's name, for texts that say it. */
  salon: string;
}

type Step = "services" | "staff" | "time" | "details" | "done";
const SAVED = "statio-booking";

export function BookingFlow(props: Props) {
  // Some texts name the salon ("So {salon} can reach you"): every text gets its name.
  const tBook = useTranslations("book");
  const t = ((key: Parameters<typeof tBook>[0], values?: Record<string, string | number | Date>) => tBook(key, { salon: props.salon, ...values })) as typeof tBook;
  const tc = useTranslations("common");
  const th = useTranslations("heard");
  const router = useRouter();
  const { locale, currency, services, staff, user } = props;

  const [step, setStep] = useState<Step>("services");
  const [picked, setPicked] = useState<string[]>(props.startService ? [props.startService] : []);
  // Two ways in: pick services first, or pick the professional first ("I always go to Marta").
  const [mode, setMode] = useState<"service" | "pro">(props.startWith ? "pro" : "service");
  const [staffId, setStaffId] = useState<string | null>(props.startWith);
  // Start on the first day the salon is open (not on a closed Sunday).
  const [day, setDay] = useState(() => {
    const closed = new Set(props.closedDays);
    let d = props.today;
    for (let i = 0; i < 14 && closed.has(d); i++) d = addDays(d, 1);
    return d;
  });
  const [slots, setSlots] = useState<{ start: number; staffId: string; fit: number }[] | null>(null);
  const [slot, setSlot] = useState<{ start: number; staffId: string } | null>(null);
  const [details, setDetails] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", forOther: false, otherName: "", notes: "", heardFrom: "", recommendedBy: "", city: "", consent: false });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<BookResult, { ok: true }> | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  // Coming back from sign-in: restore what was picked.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SAVED) ?? "null");
      if (saved) {
        sessionStorage.removeItem(SAVED);
        setPicked(saved.picked);
        setStaffId(saved.staffId);
        setDay(saved.day);
        setSlot(saved.slot);
        setStep("details");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (user) setDetails((d) => ({ ...d, name: d.name || user.name, phone: d.phone || user.phone }));
  }, [user]);

  useEffect(() => onSignedInElsewhere(() => router.refresh()), [router]);

  // Tell the salon's website how tall the booking frame should be.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!inIframe() || !root.current) return;
    const ro = new ResizeObserver(() => {
      window.parent.postMessage({ type: "statio:height", height: document.documentElement.scrollHeight }, "*");
    });
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  const chosen = picked.map((id) => services.find((s) => s.id === id)!).filter(Boolean);
  const needsConsent = chosen.some((s) => s.needsConsent);
  const pro = mode === "pro" ? staff.find((p) => p.id === staffId) ?? null : null;
  // The chosen person's own time for a service, where they have one.
  const who = pro ?? staff.find((p) => p.id === (staffId ?? slot?.staffId)) ?? null;
  const minutesOf = (s: Service) => who?.durations[s.id] ?? s.durationMin;
  const duration = chosen.reduce((a, s) => a + minutesOf(s), 0);
  const price = chosen.reduce((a, s) => a + s.priceCents, 0);
  const able = staff.filter((p) => picked.every((id) => p.serviceIds.includes(id)));
  const person = (id: string | null) => staff.find((p) => p.id === id);

  // A day with nothing free: find the next day that has a time.
  const [next, setNext] = useState<{ day: string; start: number } | null | undefined>(undefined);
  useEffect(() => {
    if (step !== "time" || !slots || slots.length > 0) return setNext(undefined);
    let live = true;
    nextFree({ day, serviceIds: picked, staffId }).then((n) => live && setNext(n));
    return () => {
      live = false;
    };
  }, [step, slots, day, picked, staffId]);

  // Load times whenever the day, services or person change.
  useEffect(() => {
    if (step !== "time") return;
    let live = true;
    setSlots(null);
    fetchSlots({ day, serviceIds: picked, staffId }).then((s) => live && setSlots(s));
    return () => {
      live = false;
    };
  }, [step, day, picked, staffId]);

  // Every bookable day up to the booking window, without the days the salon is closed.
  const days = useMemo(() => {
    const closed = new Set(props.closedDays);
    return Array.from({ length: props.horizonDays }, (_, i) => addDays(props.today, i)).filter((d) => !closed.has(d));
  }, [props.horizonDays, props.today, props.closedDays]);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function goSignIn() {
    sessionStorage.setItem(SAVED, JSON.stringify({ picked, staffId, day, slot }));
    if (inIframe()) {
      window.open(`/${locale}/signin?popup=1`, "signin", "width=480,height=640");
    } else {
      router.push(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/book`)}`);
    }
  }

  function confirm() {
    if (!slot) return;
    setError(null);
    startTransition(async () => {
      const r = await placeBooking({
        day,
        start: slot.start,
        serviceIds: picked,
        staffId: staffId ?? slot.staffId,
        name: details.name,
        phone: details.phone,
        bookedForName: details.forOther ? details.otherName : undefined,
        notes: details.notes || undefined,
        heardFrom: details.heardFrom || undefined,
        recommendedBy: details.heardFrom === "recommended" ? details.recommendedBy || undefined : undefined,
        city: details.city || undefined,
        locale,
        turnstileToken,
        suggested: recommended.has(slot.start),
        consent: needsConsent ? details.consent : undefined,
      });
      if (r.ok) {
        setResult(r);
        setStep("done");
      } else {
        setError(t(`errors.${r.error}`));
        if (r.error === "slot_unavailable") {
          setSlot(null);
          setStep("time");
        }
      }
    });
  }

  const back = () =>
    setStep((s) =>
      s === "staff" ? "services" : s === "time" ? (pro || able.length <= 1 ? "services" : "staff") : s === "details" ? "time" : s,
    );
  const pickTime = (s: { start: number; staffId: string }) => {
    setSlot(s);
    setStep("details");
  };

  // Times that fill the salon's day best go on top; every time stays bookable.
  const recommended = useMemo(() => new Set(props.recommend && slots && slots.length > 6 ? recommendedStarts(slots) : []), [props.recommend, slots]);
  const grouped = useMemo(() => {
    const g: Record<"morning" | "afternoon" | "evening", { start: number; staffId: string; fit: number }[]> = { morning: [], afternoon: [], evening: [] };
    for (const s of slots ?? []) g[s.start < 12 * 60 ? "morning" : s.start < 17 * 60 ? "afternoon" : "evening"].push(s);
    return g;
  }, [slots]);

  // With a professional chosen, only what they do.
  const offered = pro ? services.filter((s) => pro.serviceIds.includes(s.id)) : services;
  const categories = [...new Set(offered.map((s) => s.category ?? ""))];
  // With several categories (e.g. Women, Men, Nails) clients pick one tab and only see those services.
  const [chosenTab, setTab] = useState(() => services.find((s) => s.id === props.startService)?.category ?? categories[0]);
  // The tab may not exist for the chosen professional: fall back to their first group.
  const tab = categories.includes(chosenTab) ? chosenTab : categories[0];
  const shown = categories.length > 1 ? [tab] : categories;

  return (
    <div ref={root} className="px-4">
      {step !== "services" && step !== "done" && (
        <button onClick={back} className="mb-3 text-sm font-medium text-muted">
          ← {tc("back")}
        </button>
      )}
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {step === "services" && (
        <section>
          {props.again && !props.startWith && (
            <button
              onClick={() => {
                const a = props.again!;
                setPicked(a.serviceIds);
                setMode(a.staffId ? "pro" : "service");
                setStaffId(a.staffId);
                setStep("time");
              }}
              className="card mb-4 flex w-full items-center gap-3 p-3 text-left"
            >
              {person(props.again.staffId) ? (
                <Avatar name={person(props.again.staffId)!.name} photo={person(props.again.staffId)!.photo} color={person(props.again.staffId)!.color} size={44} />
              ) : (
                <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-lg text-brand">↻</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">{t("bookAgain")}</span>
                <span className="block truncate font-semibold">
                  {props.again.serviceIds.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean).join(" + ")}
                  {person(props.again.staffId) && ` · ${t("with", { name: person(props.again.staffId)!.name })}`}
                </span>
              </span>
              <span className="text-brand">›</span>
            </button>
          )}
          {staff.length > 1 && (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-canvas p-1">
              {(["service", "pro"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setStaffId(null);
                  }}
                  className={`rounded-xl py-2.5 text-sm font-semibold ${mode === m ? "bg-white shadow-sm" : "text-muted"}`}
                >
                  {t(m === "service" ? "byService" : "byPro")}
                </button>
              ))}
            </div>
          )}
          {mode === "pro" && !pro ? (
            <>
              <h2 className="mb-3 text-lg font-semibold">{t("choosePro")}</h2>
              <ul className="grid gap-2">
                {staff.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        setStaffId(p.id);
                        setPicked((x) => x.filter((id) => p.serviceIds.includes(id)));
                      }}
                      className="card flex w-full items-center gap-3 p-4 text-left"
                    >
                      <Avatar name={p.name} photo={p.photo} color={p.color} size={56} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{p.name}</span>
                        {(p.jobTitle || p.title) && <span className="block text-sm text-muted">{[p.jobTitle, p.title].filter(Boolean).join(" · ")}</span>}
                      </span>
                      <span className="text-muted">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
          <>
          {pro && (
            <div className="card mb-4 flex items-center gap-3 p-3">
              <Avatar name={pro.name} photo={pro.photo} color={pro.color} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">{t("withPro")}</span>
                <span className="block font-semibold">{pro.name}</span>
              </span>
              <button onClick={() => setStaffId(null)} className="text-sm font-medium text-brand">
                {t("changePro")}
              </button>
            </div>
          )}
          <h2 className="mb-3 text-lg font-semibold">{t("chooseServices")}</h2>
          {categories.length > 1 && (
            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {categories.map((cat) => {
                const count = offered.filter((s) => (s.category ?? "") === cat && picked.includes(s.id)).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setTab(cat)}
                    className={`chip shrink-0 border px-4 py-2 text-[15px] ${cat === tab ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
                  >
                    {cat || t("otherServices")}
                    {count > 0 && <span className="ml-1.5 rounded-full bg-white/25 px-1.5 text-xs">{count}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {shown.map((cat) => (
            <div key={cat} className="mb-4">
              <ul className="card divide-y divide-line">
                {offered
                  .filter((s) => (s.category ?? "") === cat)
                  .map((s) => {
                    const on = picked.includes(s.id);
                    return (
                      <li key={s.id}>
                        <button onClick={() => toggle(s.id)} className="flex w-full items-center gap-3 p-4 text-left">
                          <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-brand bg-brand text-white" : "border-line"}`}
                          >
                            {on && "✓"}
                          </span>
                          <span className="flex-1">
                            <span className="block font-medium">{s.name}</span>
                            <span className="text-sm text-muted">{tc("minutes", { min: minutesOf(s) })}</span>
                          </span>
                          <span className="font-semibold">{money(s.priceCents, currency, locale)}</span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
          </>
          )}
        </section>
      )}

      {step === "staff" && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("chooseStaff")}</h2>
          <ul className="grid gap-2">
            <li>
              <button onClick={() => { setStaffId(null); setStep("time"); }} className="card flex w-full items-center gap-3 p-4 text-left">
                <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-xl text-brand">✦</span>
                <span>
                  <span className="block font-medium">{t("anyone")}</span>
                  <span className="text-sm text-muted">{t("anyoneHint")}</span>
                </span>
              </button>
            </li>
            {able.map((p) => (
              <li key={p.id}>
                <button onClick={() => { setStaffId(p.id); setStep("time"); }} className="card flex w-full items-center gap-3 p-4 text-left">
                  <Avatar name={p.name} photo={p.photo} color={p.color} size={56} />
                  <span>
                    <span className="block font-medium">{p.name}</span>
                    {(p.jobTitle || p.title) && <span className="text-sm text-muted">{[p.jobTitle, p.title].filter(Boolean).join(" · ")}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === "time" && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("chooseTime")}</h2>
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {days.map((d) => {
              const [wd, dn] = [dayLabel(d, locale, "short").split(/[ ,]+/)[0], Number(d.slice(8))];
              return (
                <button
                  key={d}
                  onClick={() => { setDay(d); setSlot(null); }}
                  className={`flex min-w-14 shrink-0 flex-col items-center rounded-2xl border px-2 py-2 ${d === day ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
                >
                  <span className="text-xs opacity-80">{wd}</span>
                  <span className="text-lg font-semibold">{dn}</span>
                </button>
              );
            })}
          </div>
          <p className="mb-3 text-sm font-medium">{dayLabel(day, locale)}</p>
          {slots === null ? (
            <p className="py-6 text-center text-muted">{tc("loading")}</p>
          ) : slots.length === 0 ? (
            <div className="card grid gap-3 p-6 text-center">
              <p className="text-muted">{t("noSlots")}</p>
              {next && (
                <button onClick={() => setDay(next.day)} className="btn-primary">
                  {t("nextFree", { day: dayLabel(next.day, locale, "short"), time: hhmm(next.start) })}
                </button>
              )}
            </div>
          ) : (
            <>
            {recommended.size > 0 && (
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-semibold">{t("recommended")}</h3>
                <div className="grid grid-cols-4 gap-2">
                  {slots
                    .filter((s) => recommended.has(s.start))
                    .map((s) => (
                        <button
                          key={s.start}
                          onClick={() => pickTime(s)}
                          className="relative rounded-xl border border-brand bg-white py-3 text-center font-semibold active:bg-brand-soft"
                        >
                          {/* Just a badge: no need to explain why to the client. */}
                          <Sparkle className="absolute -top-2.5 -right-2 size-4" />
                          {hhmm(s.start)}
                        </button>
                    ))}
                </div>
              </div>
            )}
            {recommended.size > 0 && <h3 className="mb-2 text-sm font-semibold">{t("allTimes")}</h3>}
            {(["morning", "afternoon", "evening"] as const).map(
              (part) =>
                grouped[part].length > 0 && (
                  <div key={part} className="mb-4">
                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t(part)}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {grouped[part].map((s) => (
                        <button
                          key={s.start}
                          onClick={() => pickTime(s)}
                          className="rounded-xl border border-line bg-white py-3 text-center font-semibold active:bg-brand-soft"
                        >
                          {hhmm(s.start)}
                        </button>
                      ))}
                    </div>
                  </div>
                ),
            )}
            </>
          )}
        </section>
      )}

      {step === "details" && slot && (
        <section className="grid gap-4">
          {/* Everything about the visit on one card, before they confirm. */}
          <div className="card grid gap-3 p-4">
            <div className="flex items-center gap-3">
              {person(slot.staffId) && <Avatar name={person(slot.staffId)!.name} photo={person(slot.staffId)!.photo} color={person(slot.staffId)!.color} size={44} />}
              <span className="min-w-0">
                <span className="block font-semibold">{chosen.map((s) => s.name).join(" + ")}</span>
                <span className="block text-sm text-muted">{t("with", { name: person(slot.staffId)?.name ?? "" })}</span>
              </span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted">{t("summary.when")}</dt>
              <dd className="font-medium">
                {dayLabel(day, locale)} · {hhmm(slot.start)}–{hhmm(slot.start + duration)}
              </dd>
              <dt className="text-muted">{t("summary.price")}</dt>
              <dd className="font-medium">
                {money(price, currency, locale)}
              </dd>
              {props.address && (
                <>
                  <dt className="text-muted">{t("summary.where")}</dt>
                  <dd>{props.address}</dd>
                </>
              )}
            </dl>
            <p className="rounded-xl bg-canvas p-2.5 text-xs text-muted">
              {props.cancellationHours > 0 ? t("summary.cancel", { hours: props.cancellationHours }) : t("summary.cancelAny")}
            </p>
          </div>

          {!user ? (
            <div className="card p-5 text-center">
              <h2 className="text-lg font-semibold">{t("signInTitle")}</h2>
              <p className="mt-1 mb-4 text-sm text-muted">{t("signInWhy")}</p>
              <button onClick={goSignIn} className="btn-primary w-full">
                {t("signIn")}
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                {t("signedInAs", { email: user.email })} ·{" "}
                <button className="underline" onClick={() => authClient.signOut().then(() => router.refresh())}>
                  {t("notYou")}
                </button>
              </p>
              <label>
                <span className="label">{t("name")}</span>
                <input className="field" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} autoComplete="name" />
              </label>
              <label>
                <span className="label">{t("phone")}</span>
                <PhoneInput value={details.phone} onChange={(phone) => setDetails((d) => ({ ...d, phone }))} country={props.country} locale={locale} />
                <span className="mt-1 block text-xs text-muted">{t("phoneHint")}</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-brand"
                  checked={details.forOther}
                  onChange={(e) => setDetails({ ...details, forOther: e.target.checked })}
                />
                <span>{t("forSomeoneElse")}</span>
              </label>
              {details.forOther && (
                <label>
                  <span className="label">{t("theirName")}</span>
                  <input className="field" value={details.otherName} onChange={(e) => setDetails({ ...details, otherName: e.target.value })} />
                </label>
              )}
              <label>
                <span className="label">
                  {t("notes")} <span className="font-normal">({tc("optional")})</span>
                </span>
                <textarea className="field" rows={2} value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} />
              </label>
              {props.questions && (props.questions.heard || props.questions.city) && (
                <div className="grid gap-3 rounded-2xl border border-line p-4">
                  <p className="text-sm text-muted">{t("questions.intro")}</p>
                  {props.questions.heard && (
                    <div>
                      <span className="label">{t("questions.heard")}</span>
                      <div className="flex flex-wrap gap-2">
                        {props.questions.heard.map((o) => (
                          <button
                            key={o}
                            type="button"
                            onClick={() => setDetails({ ...details, heardFrom: details.heardFrom === o ? "" : o })}
                            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${details.heardFrom === o ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
                          >
                            {heardLabel(o, th)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {details.heardFrom === "recommended" && (
                    <label>
                      <span className="label">
                        {t("questions.who")} <span className="font-normal">({tc("optional")})</span>
                      </span>
                      <input className="field" maxLength={120} value={details.recommendedBy} onChange={(e) => setDetails({ ...details, recommendedBy: e.target.value })} />
                    </label>
                  )}
                  {props.questions.city && (
                    <label>
                      <span className="label">
                        {t("questions.city")} <span className="font-normal">({tc("optional")})</span>
                      </span>
                      <input className="field" maxLength={80} autoComplete="address-level2" value={details.city} onChange={(e) => setDetails({ ...details, city: e.target.value })} />
                    </label>
                  )}
                </div>
              )}
              {needsConsent && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-4 text-sm">
                  <input type="checkbox" checked={details.consent} onChange={(e) => setDetails({ ...details, consent: e.target.checked })} className="mt-0.5 size-5 shrink-0 accent-brand" />
                  <span>
                    <span className="block font-medium">{t("consent.title")}</span>
                    <span className="block text-muted">{t("consent.text")}</span>
                  </span>
                </label>
              )}
              {props.turnstileSiteKey && <Turnstile siteKey={props.turnstileSiteKey} onToken={setTurnstileToken} />}
            </>
          )}
        </section>
      )}

      {step === "done" && result && (
        <section className="card p-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-brand-soft text-2xl text-brand">✓</div>
          <h2 className="text-xl font-semibold">{result.status === "pending" ? t("doneRequestTitle") : t("doneTitle")}</h2>
          <p className="mt-2 text-muted">
            {result.status === "pending" ? t("doneRequestBody", { email: result.email }) : t("doneBody", { email: result.email })}
          </p>
          {result.status === "confirmed" && (
            <div className="mt-5">
              <AddToCalendar token={result.token} locale={locale} />
            </div>
          )}
          <div className="mt-5 grid gap-2">
            <a className="btn-ghost" href={`/${locale}/manage/${result.token}`}>
              {t("manage")}
            </a>
            <button
              className="btn-ghost"
              onClick={() => {
                setPicked([]);
                setSlot(null);
                setResult(null);
                setStep("services");
              }}
            >
              {t("bookAnother")}
            </button>
          </div>
        </section>
      )}

      {/* Sticky action bar, within thumb reach. */}
      {((step === "services" && !(mode === "pro" && !pro)) || (step === "details" && user)) && (
        <div className="pb-safe fixed inset-x-0 bottom-0 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur">
          <div className="mx-auto max-w-lg">
            {step === "services" ? (
              <>
                {picked.length > 0 && (
                  <p className="mb-2 text-center text-sm text-muted">
                    {t("selected", { count: picked.length, duration, price: money(price, currency, locale) })}
                  </p>
                )}
                <button
                  disabled={picked.length === 0 || able.length === 0 || (mode === "pro" && !pro)}
                  onClick={() => setStep(pro || able.length <= 1 ? "time" : "staff")}
                  className="btn-primary w-full"
                >
                  {tc("next")}
                </button>
              </>
            ) : (
              <button
                disabled={pending || !details.name.trim() || details.phone.trim().length < 6 || (needsConsent && !details.consent) || (!!props.turnstileSiteKey && !turnstileToken)}
                onClick={confirm}
                className="btn-primary w-full"
              >
                {pending ? tc("loading") : t("confirm")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
