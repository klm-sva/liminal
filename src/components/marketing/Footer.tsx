import Link from "next/link";

const links: Record<string, { label: string; href?: string }[]> = {
  Platform: [
    { label: "Features" },
    { label: "Credit Tracker" },
    { label: "Narratives" },
    { label: "Document Hub" },
    { label: "Integrations" },
    { label: "Security" },
  ],
  Programs: [
    { label: "LEED BD+C v4.1" },
    { label: "WELL v2" },
    { label: "WELL Health-Safety" },
    { label: "Program Comparison" },
  ],
  Resources: [
    { label: "Documentation" },
    { label: "Blog" },
    { label: "Webinars" },
    { label: "Credit Library" },
    { label: "Status" },
  ],
  Company: [
    { label: "About",   href: "/about" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact" },
    { label: "Careers" },
    { label: "Press" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-certify-navy">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        {/* Top row */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 pb-12 border-b border-white/10">
          {/* Brand */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2 group w-fit">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #388fa6, #1c5e70)" }}
              >
                <svg width="30" height="30" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M11 2L18.8 15.5L3.2 15.5ZM11 5.5L15.75 13.75L6.25 13.75Z" fill="rgba(0,0,0,0.30)" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M10 1L17.8 14.5L2.2 14.5ZM10 4.5L14.75 12.75L5.25 12.75Z" fill="white" />
                </svg>
              </div>
              <span className="font-serif text-xl text-white">
                Liminal
              </span>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed max-w-xs">
              Documentation for LEED, WELL, and beyond. Helping
              sustainability professionals certify smarter.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              {[
                {
                  label: "LinkedIn",
                  href: "#",
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                      <circle cx="4" cy="4" r="2"/>
                    </svg>
                  ),
                },
                {
                  label: "Twitter/X",
                  href: "#",
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  ),
                },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([section, items]) => (
            <div key={section}>
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">
                {section}
              </p>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="text-sm text-white/55 hover:text-white transition-colors"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="text-sm text-white/30">{item.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8">
          <p className="text-xs text-white/35">
            © {new Date().getFullYear()} Liminal. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-white/35 hover:text-white/60 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-white/35 hover:text-white/60 transition-colors">Terms of Service</Link>
            <span className="text-xs text-white/20">Cookie Policy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
