import fastf1
from pathlib import Path


class SessionLoader:
    """
    Loads any Formula 1 session for a given season and race.
    """

    def __init__(self, cache_path="../cache"):
        self.cache_path = Path(cache_path)
        fastf1.Cache.enable_cache(self.cache_path)

    def load_session(self, season, grand_prix, session_type):
        """
        season = 2025

        grand_prix =
            "Australian Grand Prix"

        session_type =
            "FP1"
            "FP2"
            "FP3"
            "SQ"
            "S"
            "Q"
            "R"
        """

        session = fastf1.get_session(
            season,
            grand_prix,
            session_type
        )

        print("Downloading session...")

        session.load()

        print("Session loaded successfully!")

        return session