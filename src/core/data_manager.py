from pathlib import Path
import fastf1


class DataManager:
    """
    Central manager responsible for loading Formula 1 data.
    """

    def __init__(self, cache_path="../cache"):

        self.cache_path = Path(cache_path)

        fastf1.Cache.enable_cache(self.cache_path)

    def load_session(self, season, event, session):

        session = fastf1.get_session(
            season,
            event,
            session
        )

        session.load()

        return session