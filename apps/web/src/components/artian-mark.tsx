import Image from "next/image";

/** Official Artian Capital Group mark, cropped from the supplied brand asset. */
export function ArtianMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/brand/artian-mark.png"
      alt="Artian Capital Group"
      width={64}
      height={64}
      className={className}
    />
  );
}

/** Full wordmark, used on authentication screens. */
export function ArtianLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/brand/artian-logo.png"
      alt="Artian Capital Group"
      width={1280}
      height={720}
      className={className}
    />
  );
}
