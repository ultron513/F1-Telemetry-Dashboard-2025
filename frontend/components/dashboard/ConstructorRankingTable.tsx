"use client";

interface ConstructorStanding {
  position: number;
  team: string;
  points: number;
}

interface Props {
  standings: ConstructorStanding[];
}

export default function ConstructorRankingTable({
  standings,
}: Props) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow">
      <h2 className="mb-4 text-xl font-semibold">
        Constructor Championship
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800">
            <tr className="text-left text-zinc-400">
              <th className="py-3">Pos</th>
              <th>Team</th>
              <th>Points</th>
            </tr>
          </thead>

          <tbody>
            {standings.map((team) => (
              <tr
                key={team.position}
                className="border-b border-zinc-800 hover:bg-zinc-800/40"
              >
                <td className="py-3 font-semibold">
                  {team.position}
                </td>

                <td>{team.team}</td>

                <td>{team.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}