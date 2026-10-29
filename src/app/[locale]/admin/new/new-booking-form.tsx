"use client";
import { formatPhone } from "@/lib/phone";
import { PhoneInput } from "@/components/phone-input";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { SlotPicker } from "@/components/admin/slot-picker";
import { hhmm, money } from "@/lib/format";
import { addDays, hhmmToMinutes } from "@/lib/time";
import { PersonPicker } from "@/components/admin/person-picker";
import { adminBook, guestForWalkIn, quickAddClient, searchClients } from "../_actions/visits";
import { User } from "@/components/icons";

type Client = { id: string; name: string; phone: string | null; email: string | null; guest?: boolean; guestName?: string };

export function NewBookingForm(props: {
  locale: string;
  currency: string;
  day: string;
  staffId: string | null;
  services: { id: string; name: string; group: string | null; durationMin: number; priceCents: number }[];
  people: { id: string; name: string; photo: string | null; color: string; serviceIds: string[] }[];
  client: Client | null;
  serviceIds: string[];
  walkIn: boolean;
  /** The salon's country, for a new client's phone number. */
  country: string | null;
  nowMin: number;
}) {
  const t = useTranslations("admin.newBooking");
  const tc = useTranslations("common");
  const tb = useTranslations("book.errors");
  const tbk = useTranslations("book");
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(props.client);
  const [picked, setPicked] = useState<string[]>(props.serviceIds);
  const [free, setFree] = useState(props.walkIn);
  const [freeTime, setFreeTime] = useState(hhmm(props.nowMin));
  const tw = useTranslations("admin.walkin");
  const [staffId, setStaffId] = useState<string | null>(props.staffId);
  const [day, setDay] = useState(props.day);
  const [slot, setSlot] = useState<{ start: number; staffId: string } | null>(null);
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const groups = [...new Set(props.services.map((s) => s.group))];
  const able = props.people.filter((p) => picked.every((id) => p.serviceIds.includes(id)));
  const total = picked.reduce((a, id) => a + (props.services.find((s) => s.id === id)?.priceCents ?? 0), 0);

  const freeStart = /^\d{2}:\d{2}$/.test(freeTime) ? hhmmToMinutes(freeTime) : null;
  const ready = !!client && picked.length > 0 && (free ? freeStart != null && !!staffId : !!slot);

  function book() {
    if (!client || !ready) return;
    setError(null);
    start(async () => {
      const r = free
        ? await adminBook({ clientId: client.id, day, start: freeStart!, serviceIds: picked, staffId, notify: notify && !!client.email, force: true, guestName: client.guestName })
        : await adminBook({ clientId: client.id, day, start: slot!.start, serviceIds: picked, staffId: slot!.staffId, notify: notify && !!client.email, guestName: client.guestName });
      if (r.ok) router.push(`/${props.locale}/admin/calendar?day=${day}`);
      else setError(tb(r.error === "slot_unavailable" || r.error === "outside_hours" ? r.error : "invalid"));
    });
  }

  return (
    <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-5 p-4 pb-32 md:px-8">
      <ClientPicker value={client} onChange={setClient} walkIn={props.walkIn} country={props.country} locale={props.locale} />

      {/* Services as big cards by group, with time and price: one tap each, several allowed. */}
      <div className="grid gap-3">
        <span className="label !mb-0">{t("services")}</span>
        {groups.map((g) => (
          <div key={g ?? ""} className="grid gap-2">
            {groups.length > 1 && <span className="text-xs font-semibold tracking-wide text-muted uppercase">{g ?? "—"}</span>}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {props.services
                .filter((s) => s.group === g)
                .map((s) => {
                  const on = picked.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      aria-pressed={on}
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                      className={`relative grid min-h-16 content-center gap-0.5 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${on ? "border-brand bg-brand-soft ring-2 ring-brand" : "border-line bg-white"}`}
                    >
                      <span className="pr-5 text-sm leading-tight font-semibold">{s.name}</span>
                      <span className="text-xs text-muted">
                        {tc("minutes", { min: s.durationMin })}
                        {s.priceCents > 0 && ` · ${money(s.priceCents, props.currency, props.locale)}`}
                      </span>
                      {on && <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-brand text-xs text-white">✓</span>}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {props.people.length > 1 && (
        <div>
          <span className="label">{t("staff")}</span>
          <PersonPicker people={free ? props.people : able} value={staffId} onChange={setStaffId} anyone={free ? undefined : tbk("anyone")} />
        </div>
      )}

      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-0.5 size-5 accent-brand" checked={free} onChange={(e) => setFree(e.target.checked)} />
        <span>
          <span className="block font-medium">{tw("toggle")}</span>
          <span className="block text-sm text-muted">{tw("hint")}</span>
        </span>
      </label>

      {free ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 grid grid-cols-3 gap-2">
            {[props.day, addDays(props.day, 1)].map((d, i) => (
              <button key={d} type="button" onClick={() => setDay(d)} className={`min-h-11 rounded-xl border font-medium ${day === d ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
                {i === 0 ? t("today") : t("tomorrow")}
              </button>
            ))}
            <input type="date" aria-label={t("day")} className="field !py-2" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </div>
          <label>
            <span className="label">{tw("time")}</span>
            <input type="time" step={300} className="field" value={freeTime} onChange={(e) => setFreeTime(e.target.value)} />
          </label>
          {!staffId && <p className="col-span-2 text-sm text-amber-700">{tw("needsPerson")}</p>}
        </div>
      ) : (
        <SlotPicker
          day={day}
          onDay={setDay}
          serviceIds={picked}
          staffId={staffId && able.some((p) => p.id === staffId) ? staffId : null}
          value={slot}
          onChange={setSlot}
          staffNames={Object.fromEntries(props.people.map((p) => [p.id, p.name]))}
        />
      )}

      {client?.email && (
        <label className="flex items-center gap-3">
          <input type="checkbox" className="size-5 accent-brand" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          {t("notify")}
        </label>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur md:left-60">
        <div className="mx-auto w-full max-w-6xl md:px-4">
          <button disabled={!ready || pending} onClick={book} className="btn-primary flex w-full">
            {!client ? t("pickClient") : `${t("save")}${total ? ` · ${money(total, props.currency, props.locale)}` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientPicker({ value, onChange, walkIn, country, locale }: { value: Client | null; onChange: (c: Client | null) => void; walkIn?: boolean; country: string | null; locale: string }) {
  const t = useTranslations("admin.newBooking");
  const tcl = useTranslations("admin.clients");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);
  // A guest in one tap: the visit is recorded, but nobody is added to the client list.
  const useGuest = async () => {
    setBusy(true);
    onChange(await guestForWalkIn());
    setBusy(false);
  };
  const tw = useTranslations("admin.walkin");

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const id = setTimeout(() => searchClients(q).then(setResults), 200);
    return () => clearTimeout(id);
  }, [q]);

  if (value) {
    return (
      <div>
        <span className="label">{t("client")}</span>
        <div className="card grid gap-2 p-3.5">
          <div className="flex items-center gap-3">
            <span className="flex-1">
              <span className="block font-medium">{value.guest ? tw("guestLabel") : value.name}</span>
              <span className="text-sm text-muted">{value.guest ? tw("guestHint") : [formatPhone(value.phone), value.email].filter(Boolean).join(" · ")}</span>
            </span>
            <button type="button" onClick={() => onChange(null)} className="flex size-10 items-center justify-center rounded-full text-sm font-medium text-brand" aria-label={tw("back")}>
              ✕
            </button>
          </div>
          {/* A guest's name is optional, typed only if it helps (e.g. to call them when it's their turn). */}
          {value.guest && (
            <input
              className="field"
              placeholder={tw("guestName")}
              defaultValue={value.guestName ?? ""}
              maxLength={60}
              onBlur={(e) => onChange({ ...value, guestName: e.target.value.trim() || undefined })}
            />
          )}
        </div>
      </div>
    );
  }

  if (adding) {
    return (
      <div className="card grid gap-3 p-4">
        <input className="field" placeholder={tcl("name")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
        <PhoneInput key={draft.name} value={draft.phone} onChange={(phone) => setDraft((d) => ({ ...d, phone }))} country={country} locale={locale} placeholder={tcl("phone")} />
        <input className="field" placeholder={tcl("email")} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        <button
          type="button"
          disabled={!draft.name.trim()}
          className="btn-primary"
          onClick={async () => {
            onChange(await quickAddClient(draft));
            setAdding(false);
          }}
        >
          {t("newClient")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <span className="label">{t("client")}</span>
      <input className="field" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <ul className="card mt-2 divide-y divide-line">
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onChange(c)} className="w-full p-3 text-left">
                <span className="block font-medium">{c.name}</span>
                <span className="text-sm text-muted">{[formatPhone(c.phone), c.email].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* The two other ways, as big buttons: a new client, or a guest with no record (walk-ins first). */}
      <div className={`mt-3 grid grid-cols-2 gap-2 ${walkIn ? "[&>*:last-child]:order-first" : ""}`}>
        <button
          type="button"
          onClick={() => {
            setDraft({ name: /\d/.test(q) ? "" : q, phone: /\d/.test(q) ? q : "", email: "" });
            setAdding(true);
          }}
          className="btn-ghost min-h-14"
        >
          + {t("newClient")}
        </button>
        <button type="button" disabled={busy} onClick={useGuest} className={`min-h-14 ${walkIn ? "btn-primary" : "btn-ghost"}`}>
          <User className="inline size-4 align-[-3px]" /> {tw("guestButton")}
        </button>
      </div>
    </div>
  );
}
