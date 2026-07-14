"use client";

import TelemetryChart from "@/components/charts/TelemetryChart";

interface Props {
  telemetry: any[];
  compareTelemetry?: any[];
}

export default function TelemetryPanel({
  telemetry,
  compareTelemetry = [],
}: Props) {
    const brakeData = telemetry.map((point) => ({
  ...point,
  brake: point.brake ? 1 : 0,
}));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <TelemetryChart
        title="Speed vs Distance"
        data={telemetry}
        compareData={compareTelemetry}
        xKey="distance"
        yKey="speed"
        color="#ef4444"
        unit="km/h"
      />

      <TelemetryChart
        title="Throttle %"
        data={telemetry}
        compareData={compareTelemetry}
        xKey="distance"
        yKey="throttle"
        color="#22c55e"
        unit="%"
      />

      <TelemetryChart
        title="RPM"
        data={telemetry}
        compareData={compareTelemetry}
        xKey="distance"
        yKey="rpm"
        color="#3b82f6"
        unit="RPM"
      />

      <TelemetryChart
        title="Gear"
        data={telemetry}
        compareData={compareTelemetry}
        xKey="distance"
        yKey="gear"
        color="#facc15"
        unit=""
      />

      <TelemetryChart
        title="Brake"
        data={brakeData}
        compareData={compareTelemetry}
        xKey="distance"
        yKey="brake"
        color="#f97316"
        unit=""
        />

      <TelemetryChart
        title="DRS"
        data={telemetry}
        compareData={compareTelemetry}
        xKey="distance"
        yKey="drs"
        color="#a855f7"
        unit=""
        /> 

    </div>
  );
}