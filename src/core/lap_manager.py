import pandas as pd


class LapManager:
    """
    Handles lap-related operations for a Formula 1 session.
    """

    def __init__(self, session):
        self.session = session

    def get_all_laps(self):
        """
        Returns all laps in the session.
        """
        return self.session.laps

    def get_driver_laps(self, driver):
        """
        Returns all laps for a specific driver.
        """
        return self.session.laps.pick_drivers(driver)

    def get_fastest_lap(self, driver):
        """
        Returns the driver's fastest lap.
        """
        return self.get_driver_laps(driver).pick_fastest()

    def get_lap_summary(self, driver):
        """
        Returns a clean summary of all laps.
        """

        laps = self.get_driver_laps(driver)

        columns = [
            "LapNumber",
            "LapTime",
            "Sector1Time",
            "Sector2Time",
            "Sector3Time",
            "Compound",
            "TyreLife",
            "Stint",
            "FreshTyre",
            "TrackStatus",
            "Position",
            "PitInTime",
            "PitOutTime"
        ]

        available_columns = [col for col in columns if col in laps.columns]

        return laps[available_columns]