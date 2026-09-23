import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="card">
      <p className="eyebrow">404</p>
      <h1>This page isn’t on the path.</h1>
      <p>Return to your workspace to continue exploring.</p>
      <Link href="/" className="primary-link">
        Back to overview
      </Link>
    </section>
  );
}
