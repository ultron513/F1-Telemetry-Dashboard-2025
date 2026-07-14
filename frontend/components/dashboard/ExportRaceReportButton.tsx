"use client";

import { Download } from "lucide-react";

interface Props {
  onExport: () => void;
}

export default function ExportRaceReportButton({
  onExport,
}: Props) {
  return (
    <button
      onClick={onExport}
      className="
        flex
        items-center
        gap-2
        rounded-lg
        bg-blue-600
        px-4
        py-2
        font-semibold
        text-white
        transition
        hover:bg-blue-700
      "
    >
      <Download size={18} />
      Export Race Report
    </button>
  );
}