import pandas as pd

from telemetry.telemetry_engine import TelemetryEngine


class DriverTelemetryAnalysis:
    """
    Complete backend for a single driver's lap analysis.
    """

    def __init__(self, session):

        self.session = session

        self.engine = TelemetryEngine(session)

    def analyze(self, driver, lap_number):

        telemetry = self.engine.get_full_telemetry(
            driver,
            lap_number
        )

        return {

            "driver": driver,

            "lap": lap_number,

            "telemetry": telemetry

        }