import pandas as pd


class DriverManager:
    """
    Handles all driver-related information from a loaded session.
    """

    def __init__(self, session):
        self.session = session

    def get_all_drivers(self):
        """
        Returns a DataFrame containing every driver
        participating in the selected session.
        """

        drivers = []

        for drv in self.session.drivers:

            info = self.session.get_driver(drv)

            drivers.append({

                "DriverNumber": info["DriverNumber"],

                "FullName": info["FullName"],

                "Abbreviation": info["Abbreviation"],

                "BroadcastName": info["BroadcastName"],

                "TeamName": info["TeamName"],

                "TeamColor": info["TeamColor"],

                "CountryCode": info["CountryCode"]

            })

        return pd.DataFrame(drivers)