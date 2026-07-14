"use client";

import DashboardLayout from "../../components/layout/DashboardLayout";
import DriverRankingTable from "../../components/dashboard/DriverRankingTable";
import ConstructorRankingTable from "../../components/dashboard/ConstructorRankingTable";

import useDriverStandings from "../../hooks/useDriverStandings";
import useConstructorStandings from "../../hooks/useConstructorStandings";

export default function StandingsPage() {
  const driverQuery = useDriverStandings();
  const constructorQuery = useConstructorStandings();

  if (
    driverQuery.isLoading ||
    constructorQuery.isLoading
  ) {
    return (
      <DashboardLayout>
        <div className="p-6">
          Loading...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <DriverRankingTable
          standings={driverQuery.data ?? []}
        />

        <ConstructorRankingTable
          standings={constructorQuery.data ?? []}
        />
      </div>
    </DashboardLayout>
  );
}