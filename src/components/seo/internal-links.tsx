import Link from "next/link";

interface InternalLinkSectionProps {
  heading: string;
  links: { href: string; label: string }[];
}

export function InternalLinkSection({
  heading,
  links,
}: InternalLinkSectionProps) {
  if (links.length === 0) return null;
  return (
    <nav className="sr-only" aria-label={heading}>
      <h2>{heading}</h2>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
