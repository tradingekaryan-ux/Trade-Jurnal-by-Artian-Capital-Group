import type { SVGProps } from "react";

/** Brand mark for Trade Jurnal by Artian Capital Group. */
export function ArtianMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="currentColor" opacity="0.12" />
      <path
        d="M7 22V10l9 7 9-7v12"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="19" r="2.2" fill="currentColor" />
    </svg>
  );
}
