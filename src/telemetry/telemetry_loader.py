import pandas as pd


class TelemetryLoader:
    """
    Extract telemetry from a FastF1 session.
    """

    def __init__(self, session):
        self.session = session

    def get_driver_laps(self, driver):
        """
        Returns every lap completed by the driver.
        """

        return self.session.laps.pick_drivers(driver)

    def get_fastest_lap(self, driver):
        """
        Returns the driver's fastest lap.
        """

        laps = self.get_driver_laps(driver)

        return laps.pick_fastest()

    def get_fastest_lap_telemetry(self, driver):
        """
        Returns telemetry of the driver's fastest lap.
        """

        lap = self.get_fastest_lap(driver)

        telemetry = lap.get_car_data().add_distance()

        return telemetry