import Link from "next/link";

/** Attribution shown in every footer of the application. */
export function PoweredByLuxAlgo({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      Powered by{" "}
      <Link
        href="https://www.luxalgo.com/"
        className="underline underline-offset-2 hover:text-foreground"
        target="_blank"
        rel="noreferrer"
      >
        Lux Algo
      </Link>
    </p>
  );
}
