import Link from "next/link";

/**
 * The canonical GIO4X logo, always rendered from the supplied asset and never
 * redrawn, recoloured or distorted. Intrinsic ratio 960×299.
 */
export function Logo({ height = 34, href = "/", className }: { height?: number; href?: string | null; className?: string }) {
  const width = Math.round((height * 960) / 299);
  const img = (
    <picture>
      <source srcSet="/brand/gio4x-logo.webp" type="image/webp" />
      <img src="/brand/gio4x-logo.png" alt="GIO4X" width={width} height={height} decoding="async" style={{ height, width: "auto" }} />
    </picture>
  );
  if (!href) return <span className={className}>{img}</span>;
  return (
    <Link href={href} className={className} aria-label="GIO4X home">
      {img}
    </Link>
  );
}

export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <picture className={className}>
      <source srcSet="/brand/gio4x-mark.webp" type="image/webp" />
      <img src="/brand/gio4x-mark.png" alt="" width={size} height={size} decoding="async" />
    </picture>
  );
}
