"use client";

interface DriverStanding {
  position: number;
  driver: string;
  team: string;
  points: number;
  wins: number;
}

interface Props {
  standings: DriverStanding[];
}

export default function DriverRankingTable({
  standings,
}: Props) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow">
      <h2 className="mb-4 text-xl font-semibold">
        Driver Championship
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800">
            <tr className="text-left text-zinc-400">
              <th className="py-3">Pos</th>
              <th>Driver</th>
              <th>Team</th>
              <th>Points</th>
              <th>Wins</th>
            </tr>
          </thead>

          <tbody>
            {standings.map((driver) => (
              <tr
                key={driver.position}
                className="border-b border-zinc-800 hover:bg-zinc-800/40"
              >
                <td className="py-3 font-semibold">
                  {driver.position}
                </td>

                <td>{driver.driver}</td>

                <td>{driver.team}</td>

                <td>{driver.points}</td>

                <td>{driver.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}