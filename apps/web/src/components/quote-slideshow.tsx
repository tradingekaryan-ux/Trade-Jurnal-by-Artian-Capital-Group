"use client";

import { useEffect, useState } from "react";

/** Rotating motivational quotes; interval and content are owner-configurable. */
export function QuoteSlideshow() {
  const [quotes, setQuotes] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [intervalMs, setIntervalMs] = useState(3000);

  useEffect(() => {
    fetch("/api/quotes")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { quotes: string[]; intervalMs: number }) => {
        setQuotes(body.quotes);
        setIntervalMs(body.intervalMs);
        setIndex(0);
      })
      .catch(() => setQuotes([]));
  }, []);

  useEffect(() => {
    if (quotes.length <= 1) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % quotes.length),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [quotes.length, intervalMs]);

  if (quotes.length === 0) return null;
  return (
    <div className="quote-slideshow" aria-live="polite">
      <span className="quote-mark">“</span>
      <p key={index} className="quote-slide">
        {quotes[index]}
      </p>
      <div className="quote-dots" aria-hidden="true">
        {quotes.map((quote, dot) => (
          <span key={quote + dot} className={dot === index ? "active" : ""} />
        ))}
      </div>
    </div>
  );
}
