'use client';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="card">
      <h1>Something interrupted your visit.</h1>
      <p>Please try loading this page again.</p>
      <button className="primary-link" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
