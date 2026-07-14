"use client";

interface Props {
  score: number;
}

export default function PerformanceVerdictCard({
  score,
}: Props) {

  let verdict = "";
  let color = "";

  if (score >= 80) {
    verdict =
      "Outstanding pace. Driver is extracting maximum performance.";
    color = "text-green-400";
  }

  else if (score >= 60) {
    verdict =
      "Competitive pace with room for minor improvements.";
    color = "text-yellow-400";
  }

  else {
    verdict =
      "Performance below expected level. Strategy or driving adjustments recommended.";
    color = "text-red-400";
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">

      <h2 className="mb-4 text-xl font-bold">
        Performance Verdict
      </h2>

      <p className={`text-sm leading-7 ${color}`}>
        {verdict}
      </p>

    </div>
  );
}