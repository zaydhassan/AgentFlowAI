// The single content-width container every full-bleed band (page sections,
// final CTA, footer) centers inside. Sections that must share a vertical
// grid — e.g. the contact page's CTA and the footer below it — should all
// use this component so their left/right boundaries always match.
export function SiteContainer({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-5 lg:px-8 ${className}`}>{children}</div>
  );
}