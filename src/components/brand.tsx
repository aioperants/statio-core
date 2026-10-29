import { initials } from "@/lib/format";

/** The salon's logo, shown large: owners are proud of their brand. */
export function Logo({ name, logo, size = 88 }: { name: string; logo: string | null; size?: number }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={name} style={{ height: size, maxWidth: size * 2.5 }} className="object-contain" />
  ) : (
    <div
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="flex items-center justify-center rounded-3xl bg-brand font-display font-semibold text-white"
    >
      {initials(name)}
    </div>
  );
}

export function BrandHeader({ name, logo, address }: { name: string; logo: string | null; address?: string | null }) {
  return (
    <header className="flex flex-col items-center gap-3 px-4 pt-8 pb-4 text-center">
      <Logo name={name} logo={logo} />
      <div>
        <h1 className="font-display text-2xl font-semibold">{name}</h1>
        {address && <p className="mt-0.5 text-sm text-muted">{address}</p>}
      </div>
    </header>
  );
}
