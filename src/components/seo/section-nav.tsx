import Link from "next/link";

export function SectionNav() {
  return (
    <nav className="sr-only" aria-label="Main sections">
      <h2>Deploybase</h2>
      <ul>
        <li>
          <Link href="/">GPU & LLM Pricing</Link>
        </li>
        <li>
          <Link href="/gpus">GPU Cloud Pricing</Link>
        </li>
        <li>
          <Link href="/llms">LLM Inference Pricing</Link>
        </li>
        <li>
          <Link href="/tools">AI/ML Tools Directory</Link>
        </li>
      </ul>
    </nav>
  );
}
