import Link from "next/link";

/** The heats of one Call room side, to pick one from. */
export function HeatGrid({
  heats,
  href,
}: {
  heats: number[];
  href: (heat: number) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {heats.map((heat) => (
        <Link
          key={heat}
          href={href(heat)}
          className="flex h-20 items-center justify-center rounded-md border border-input text-2xl font-bold tabular-nums hover:bg-accent"
        >
          {heat}
        </Link>
      ))}
    </div>
  );
}
