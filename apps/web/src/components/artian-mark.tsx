import Image from "next/image";

/** Official Artian Capital Group icon — black circle, transparent corners. */
export function ArtianMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/brand/artian-icon.png"
      alt="Artian Capital Group"
      width={64}
      height={64}
      className={className}
    />
  );
}

/** Same icon used on authentication screens. */
export function ArtianLogo({ className = "" }: { className?: string }) {
  return <ArtianMark className={className} />;
}
