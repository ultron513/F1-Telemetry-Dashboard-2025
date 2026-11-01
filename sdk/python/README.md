# pitwall-client

Python client for the [Pit Wall](https://github.com/ultron513/F1-Telemetry-Dashboard-2025) F1 telemetry and strategy API.

```bash
pip install "pitwall-client @ git+https://github.com/ultron513/F1-Telemetry-Dashboard-2025#subdirectory=sdk/python"
# extras: [live] for the live-timing stream, [pandas] for DataFrames
```

```python
from pitwall_client import PitWall

with PitWall("http://localhost:8000") as pw:
    race = pw.session(2025, 3, "R")  # Japanese GP 2025

    duel = race.compare("VER", "NOR")
    print(f"Fastest-lap gap: {duel['final_delta']:+.3f} s")

    sim = race.simulate("VER", [("MEDIUM", 23), ("HARD", 30)])
    print(sim["hindsight"]["position"], sim["monte_carlo"]["better_share"])

    best = race.optimise("NOR")["plans"][0]
    print("Best plan:", best["plan"], best["delta"])

    print(pw.career("hamilton")["totals"]["wins"])
```

Live timing (or any past race replayed as live):

```python
import asyncio
from pitwall_client import AsyncPitWall


async def main():
    async with AsyncPitWall("http://localhost:8000") as pw:
        async for snap in pw.live(2025, 3, "R", speed=30):
            leader = snap["drivers"][0]
            print(snap["lap"], leader["code"], snap["probabilities"][0])


asyncio.run(main())
```

Errors raise `pitwall_client.ApiError` with `status`, `code`, `message` and `hint`.
