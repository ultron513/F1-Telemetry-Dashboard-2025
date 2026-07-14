import fastf1
import pandas as pd
from pathlib import Path


class SeasonLoader:
    """
    Loads and manages Formula 1 season schedules.
    """

    def __init__(self, season=2025):
        self.season = season

    def load_schedule(self):
        """
        Download the complete season schedule.
        """

        schedule = fastf1.get_event_schedule(self.season)

        return schedule

    def get_races_only(self):
        """
        Remove pre-season testing.
        """

        schedule = self.load_schedule()

        races = schedule[
            schedule["EventFormat"] != "testing"
        ].reset_index(drop=True)

        return races

    def save_schedule(self, filepath):
        """
        Save the schedule as CSV.
        """

        races = self.get_races_only()

        filepath = Path(filepath)

        filepath.parent.mkdir(parents=True, exist_ok=True)

        races.to_csv(filepath, index=False)

        print(f"Schedule saved to: {filepath}")