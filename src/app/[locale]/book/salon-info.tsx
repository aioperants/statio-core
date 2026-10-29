/**
 * Below the booking: about the salon, opening hours, how to reach it and its profiles. Clients
 * look for these, and search engines only trust details the page really shows.
 */
export function SalonInfo(props: {
  business: { name: string; about: string | null; address: string | null; phone: string | null; website: string | null };
  hours: { days: string; hours: string }[];
  links: { key: string; label: string; url: string }[];
  label: { hours: string; call: string };
}) {
  const b = props.business;
  const links = [...(b.website ? [{ key: "website", label: new URL(b.website).hostname.replace(/^www\./, ""), url: b.website }] : []), ...props.links];
  if (!b.about && !props.hours.length && !b.phone && !links.length) return null;
  return (
    <footer className="mx-4 mt-8 grid gap-4 border-t border-line pt-6 text-sm text-muted">
      {b.about && <p className="text-ink">{b.about}</p>}
      {props.hours.length > 0 && (
        <div>
          <h2 className="mb-1 font-semibold text-ink">{props.label.hours}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
            {props.hours.map((h) => (
              <div key={h.days} className="contents">
                <dt className="capitalize">{h.days}</dt>
                <dd>{h.hours}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div className="grid gap-1">
        {b.address && <p>{b.address}</p>}
        {b.phone && (
          <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="font-medium text-brand">
            {props.label.call} {b.phone}
          </a>
        )}
      </div>
      {links.length > 0 && (
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer me" className="font-medium text-brand">
              {l.label} ↗
            </a>
          ))}
        </nav>
      )}
    </footer>
  );
}
