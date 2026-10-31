import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-sm text-ink-3">404</p>
      <h1 className="display mt-2 text-4xl">Off track</h1>
      <p className="mt-2 max-w-md text-ink-2">That page isn&rsquo;t on the circuit map. Head back to the session overview.</p>
      <Link href="/" className="mt-5 rounded-md bg-team px-4 py-2 text-sm font-semibold text-on-team">
        Back to overview
      </Link>
    </div>
  );
}
