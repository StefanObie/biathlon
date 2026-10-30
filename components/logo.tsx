import Image from "next/image";

/** The Crossland Biathlon mark: black on transparent, so inverted on dark. */
export function Logo({ size, preload }: { size: number; preload?: boolean }) {
  return (
    <Image
      src="/apple-touch-icon.png"
      alt=""
      width={size}
      height={size}
      preload={preload}
      className="shrink-0 dark:invert"
    />
  );
}
