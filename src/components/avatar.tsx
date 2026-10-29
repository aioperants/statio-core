/** A person's photo, or their initial on their calendar colour. */
export function Avatar({ name, photo, color, size = 44 }: { name: string; photo?: string | null; color?: string; size?: number }) {
  const style = { width: size, height: size };
  // eslint-disable-next-line @next/next/no-img-element
  if (photo) return <img src={photo} alt={name} style={style} className="shrink-0 rounded-full object-cover" />;
  return (
    <span style={{ ...style, background: color ?? "#DCE8FB", fontSize: size * 0.4 }} className="flex shrink-0 items-center justify-center rounded-full font-semibold">
      {name[0]?.toUpperCase()}
    </span>
  );
}
