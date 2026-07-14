import pandas as pd


class TelemetryEngine:
    """
    Main telemetry engine.

    Responsible for extracting every telemetry stream
    from a selected driver's lap.
    """

    def __init__(self, session):
        self.session = session

    def get_driver_lap(self, driver, lap_number):

        laps = self.session.laps.pick_drivers(driver)

        lap = laps[laps["LapNumber"] == lap_number]

        if lap.empty:
            raise ValueError(
                f"Lap {lap_number} not found for driver {driver}"
            )

        return lap.iloc[0]

    def get_car_telemetry(self, driver, lap_number):

        lap = self.get_driver_lap(driver, lap_number)

        telemetry = lap.get_car_data().add_distance()

        return telemetry

    def get_position_data(self, driver, lap_number):

        lap = self.get_driver_lap(driver, lap_number)

        position = lap.get_pos_data()

        return position

    def get_full_telemetry(self, driver, lap_number):

        car = self.get_car_telemetry(driver, lap_number)

        pos = self.get_position_data(driver, lap_number)

        telemetry = pd.concat(
            [
                car.reset_index(drop=True),
                pos.reset_index(drop=True)
            ],
            axis=1
        )

        return telemetry