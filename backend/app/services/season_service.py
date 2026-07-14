import sys
from pathlib import Path
import fastf1
import pandas as pd
import requests
# Add project root/src to Python path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_PATH = PROJECT_ROOT / "src"

if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from data_loader.season_loader import SeasonLoader


class SeasonService:
    

    def __init__(self):
        self.loader = SeasonLoader(2025)

    def get_races(self):

        races = self.loader.get_races_only()

        return races
    def get_sessions(self, event_name):

        races = self.loader.get_races_only()

        race = races[
            races["EventName"] == event_name
        ]

        if race.empty:
            return []

        race = race.iloc[0]

        sessions = []

        for i in range(1, 6):

            value = race[f"Session{i}"]

            if value is not None:
                sessions.append(value)

        return sessions
    
    def get_drivers(self, event_name, session_name):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        results = session.results

        drivers = []

        for _, row in results.iterrows():

            drivers.append({
                "code": row["Abbreviation"],
                "full_name": row["FullName"],
                "team": row["TeamName"]
            })

        return drivers
    
    def get_teams(self, event_name, session_name):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        results = session.results

        team_names = sorted(results["TeamName"].unique())

        return team_names
    
    def get_laps(self, event_name, session_name, driver):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        laps = session.laps.pick_drivers(driver)

        lap_numbers = (
            laps["LapNumber"]
            .dropna()
            .astype(int)
            .tolist()
        )

        return lap_numbers
    
    def get_telemetry(
    self,
    event_name,
    session_name,
    driver,
    lap_number):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        laps = session.laps.pick_drivers(driver)

        lap = laps[
            laps["LapNumber"] == lap_number
        ].iloc[0]

        telemetry = lap.get_car_data().add_distance()

        return telemetry
    
    def get_lap_summary(
    self,
    event_name,
    session_name,
    driver,
    lap_number):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        lap = (
            session.laps
            .pick_drivers(driver)
            .pick_laps(lap_number)
            .iloc[0]
        )

        telemetry = lap.get_car_data().add_distance()

        return {
            "lap_time_seconds": lap["LapTime"].total_seconds(),

            "max_speed": float(telemetry["Speed"].max()),
            "average_speed": float(telemetry["Speed"].mean()),

            "max_rpm": int(telemetry["RPM"].max()),

            "average_throttle": float(
                telemetry["Throttle"].mean()
            ),

            "brake_percentage": float(
                telemetry["Brake"].mean() * 100
            ),

            "drs_percentage": float(
                (telemetry["DRS"] > 0).mean() * 100
            ),

            "telemetry_samples": len(telemetry)
        }
    
    def compare_laps(
    self,
    event_name,
    session_name,
    driver_1,
    lap_1,
    driver_2,
    lap_2
):
        summary_1 = self.get_lap_summary(
            event_name,
            session_name,
            driver_1,
            lap_1
        )

        summary_2 = self.get_lap_summary(
            event_name,
            session_name,
            driver_2,
            lap_2
        )

        return {
            "lap_1": {
                "driver": driver_1,
                "lap_number": lap_1,
                **summary_1
            },
            "lap_2": {
                "driver": driver_2,
                "lap_number": lap_2,
                **summary_2
            }
        }

    def get_circuit(self, event_name):

        races = self.loader.get_races_only()

        race = races[
            races["EventName"] == event_name
        ].iloc[0]

        return {
            "circuit_name": race["EventName"],
            "location": race["Location"],
            "country": race["Country"],
            "round_number": int(race["RoundNumber"])
        }
    
    def get_weather(
    self,
    event_name,
    session_name):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        weather = session.weather_data.iloc[0]

        return {
            "air_temperature": float(weather["AirTemp"]),
            "track_temperature": float(weather["TrackTemp"]),
            "humidity": float(weather["Humidity"]),
            "pressure": float(weather["Pressure"]),
            "wind_speed": float(weather["WindSpeed"]),
            "wind_direction": float(weather["WindDirection"]),
            "rainfall": bool(weather["Rainfall"])
        }
    
    def get_track_map(
    self,
    event_name,
    session_name,
    driver,
    lap_number):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        laps = session.laps.pick_drivers(driver)

        lap = laps[
            laps["LapNumber"] == lap_number
        ].iloc[0]

        position = lap.get_pos_data()

        return [
            {
                "x": float(row["X"]),
                "y": float(row["Y"])
            }
            for _, row in position.iterrows()
        ]
    
    def get_driver_car_data(
    self,
    event_name,
    session_name,
    driver,
    lap_number):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        lap = (
            session.laps
            .pick_drivers(driver)
            .pick_laps(lap_number)
            .iloc[0]
        )

        telemetry = lap.get_telemetry().add_distance()

        return [
            {
                "distance": float(row["Distance"]),
                "speed": float(row["Speed"]),
                "throttle": float(row["Throttle"]),
                "brake": bool(row["Brake"]),
                "rpm": float(row["RPM"]),
                "gear": int(row["nGear"]),
                "drs": int(row["DRS"]),
                "x": float(row["X"]),
                "y": float(row["Y"]),
            }
            for _, row in telemetry.iterrows()
        ]
    
    def get_lap_delta(
        self,
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    ):
        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        lap1 = (
            session.laps
            .pick_drivers(driver1)
            .pick_laps(lap_number)
            .iloc[0]
        )

        lap2 = (
            session.laps
            .pick_drivers(driver2)
            .pick_laps(lap_number)
            .iloc[0]
        )

        delta, ref_tel, compare_tel = fastf1.utils.delta_time(
            lap1,
            lap2,
        )

        return [
            {
                "distance": float(d),
                "delta": float(t),
            }
            for d, t in zip(
                ref_tel["Distance"],
                delta,
            )
        ]
    
    def get_driver_position(
    self,
    event_name,
    session_name,
    driver,
    lap_number):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        lap = (
            session.laps
            .pick_drivers(driver)
            .pick_laps(lap_number)
            .iloc[0]
        )

        position = lap.get_pos_data().reset_index(drop=True)
        return [
        {
            "x": float(row["X"]),
            "y": float(row["Y"]),
            "z": float(row["Z"]),
            "distance": float(i)
        }
        for i, (_, row) in enumerate(position.iterrows())]
    
    def get_fastest_lap(
    self,
    event_name,
    session_name):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        lap = session.laps.pick_fastest()

        return {
            "driver": lap["Driver"],
            "lap_number": int(lap["LapNumber"]),
            "lap_time_seconds": lap["LapTime"].total_seconds()
        }
    
    def get_session_results(
    self,
    event_name,
    session_name):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        results = session.results

        output = []

        for _, row in results.iterrows():

            output.append({

                "position": int(row["Position"]),

                "driver": row["Abbreviation"],

                "driver_number": str(row["DriverNumber"]),

                "team": row["TeamName"],

                "grid_position": int(row["GridPosition"]),

                "status": row["Status"],

                "points": float(row["Points"])

            })

        return output
    
    def get_driver_standings(
    self,
    event_name
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            "Race"
        )

        session.load()

        results = session.results.sort_values(
            "Position"
        )

        standings = []

        for _, row in results.iterrows():

            standings.append({

                "position": int(row["Position"]),

                "driver": row["Abbreviation"],

                "team": row["TeamName"],

                "points": float(row["Points"]),

                "wins": 1 if int(row["Position"]) == 1 else 0

            })

        return standings
    
    def get_constructor_standings(
    self,
    event_name):

        session = fastf1.get_session(
            2025,
            event_name,
            "Race"
        )

        session.load()

        results = session.results

        constructors = (
            results
            .groupby("TeamName", as_index=False)
            .agg(
                {
                    "Points": "sum"
                }
            )
            .sort_values(
                "Points",
                ascending=False
            )
            .reset_index(drop=True)
        )

        standings = []

        for idx, row in constructors.iterrows():

            standings.append({

                "position": idx + 1,

                "team": row["TeamName"],

                "points": float(row["Points"]),

                "wins": 0

            })

        return standings
    
    def get_tyre_strategy(
    self,
    event_name,
    session_name,
    driver
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        laps = session.laps

        driver_laps = laps.pick_drivers(driver)

        stints = (
            driver_laps
            .groupby("Stint")
            .agg(
                Compound=("Compound", "first"),
                Laps=("LapNumber", "count"),
                FreshTyre=("FreshTyre", "first"),
            )
            .reset_index()
        )

        output = []

        for _, row in stints.iterrows():

            output.append({

                "driver": driver,

                "stint": int(row["Stint"]),

                "compound": row["Compound"],

                "laps": int(row["Laps"]),

                "fresh_tyre": bool(row["FreshTyre"])

            })

        return output
    
    def get_tyre_degradation(
        self,
        event_name,
        session_name,
        driver,
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        laps = (
            session
            .laps
            .pick_drivers(driver)
            .pick_quicklaps()
        )

        output = []

        for _, lap in laps.iterrows():

            if lap["LapTime"] is None:
                continue

            output.append({

                "lap": int(lap["LapNumber"]),

                "lap_time": lap["LapTime"].total_seconds()

            })

        return output

    
    def get_pit_stops(
    self,
    event_name,
    session_name,
    driver
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        laps = session.laps

        output = []

        driver_laps = laps.pick_drivers(driver)

        stints = (
            driver_laps
            .groupby("Stint")
            .first()
            .reset_index()
        )

        for _, row in stints.iterrows():

            if row["Stint"] == 1:
                continue

            output.append({

                "driver": driver,

                "stop": int(row["Stint"] - 1),

                "lap": int(row["LapNumber"]),

                "duration": 0.0

            })

        return output
    
    # ==========================================================
    # STEP 50 — RACE CONTROL MESSAGES
    # ==========================================================

    def get_race_control_messages(
        self,
        event_name,
        session_name
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        if not hasattr(session, "race_control_messages"):
            return []

        messages = session.race_control_messages.copy()

        output = []

        for _, row in messages.iterrows():

            output.append({

                "category": str(row.get("Category", "")),

                "message": str(row.get("Message", "")),

                "lap": int(row["Lap"]) if row.get("Lap") is not None else 0,

                "time": str(row.get("Time", ""))

            })

        return output


    # ==========================================================
    # STEP 53 — TRACK STATUS
    # ==========================================================

    def get_track_status(
        self,
        event_name,
        session_name
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        status = session.track_status.copy()

        output = []

        for _, row in status.iterrows():

            output.append({

                "time": str(row["Time"]),

                "status": str(row["Status"])

            })

        return output


    # ==========================================================
    # STEP 55 — WEATHER HISTORY
    # ==========================================================

    def get_weather_history(
        self,
        event_name,
        session_name
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        weather = session.weather_data.copy()

        output = []

        for _, row in weather.iterrows():

            output.append({

                "time": str(row["Time"]),

                "air_temperature": float(row["AirTemp"]),

                "track_temperature": float(row["TrackTemp"]),

                "humidity": float(row["Humidity"]),

                "pressure": float(row["Pressure"]),

                "wind_speed": float(row["WindSpeed"]),

                "wind_direction": float(row["WindDirection"]),

                "rainfall": bool(row["Rainfall"])

            })

        return output


    # ==========================================================
    # STEP 56 — SECTOR ANALYSIS
    # ==========================================================

    def get_sector_analysis(
        self,
        event_name,
        session_name
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        laps = session.laps.copy()

        output = []

        for _, row in laps.iterrows():

            if row["LapTime"] is None:
                continue

            output.append({

                "driver": row["Driver"],

                "lap_number": int(row["LapNumber"]),

                "sector1": row["Sector1Time"].total_seconds(),

                "sector2": row["Sector2Time"].total_seconds(),

                "sector3": row["Sector3Time"].total_seconds(),

                "total": row["LapTime"].total_seconds()

            })

        return output


    # ==========================================================
    # STEP 58 — SPEED TRAPS
    # ==========================================================

    def get_speed_traps(
        self,
        event_name,
        session_name
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        results = session.results.copy()

        output = []

        for _, row in results.iterrows():

            output.append({

                "driver": row["Abbreviation"],

                "sector1_speed": float(row.get("SpeedI1", 0)),

                "sector2_speed": float(row.get("SpeedI2", 0)),

                "finish_speed": float(row.get("SpeedFL", 0)),

                "max_speed": float(row.get("SpeedST", 0))

            })

        return output

    # ==========================================================
    # STEP 64 — DRIVER CONSISTENCY
    # ==========================================================

    def get_driver_consistency(
        self,
        event_name,
        session_name,
        driver
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        laps = (
            session.laps
            .pick_drivers(driver)
            .pick_quicklaps()
            .copy()
        )

        mean_time = laps["LapTime"].dt.total_seconds().mean()

        output = []

        for _, row in laps.iterrows():

            lap_time = row["LapTime"].total_seconds()

            output.append({

                "lap_number": int(row["LapNumber"]),

                "lap_time": lap_time,

                "deviation": lap_time - mean_time

            })

        return output


    # ==========================================================
    # STEP 65 — RACE PACE
    # ==========================================================

    def get_race_pace(
        self,
        event_name
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            "Race"
        )

        session.load()

        output = []

        for driver in sorted(session.laps["Driver"].dropna().unique()):

            laps = (
                session.laps
                .pick_drivers(driver)
                .pick_quicklaps()
            )

            if laps.empty:
                continue

            lap_times = laps["LapTime"].dt.total_seconds()

            output.append({

                "driver": driver,

                "average_lap": float(lap_times.mean()),

                "fastest_lap": float(lap_times.min()),

                "total_laps": len(lap_times)

            })

        return output


    # ==========================================================
    # STEP 66 — QUALIFYING PACE
    # ==========================================================

    def get_qualifying_pace(
        self,
        event_name
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            "Qualifying"
        )

        session.load()

        output = []

        for driver in sorted(session.laps["Driver"].dropna().unique()):

            laps = (
                session.laps
                .pick_drivers(driver)
                .pick_quicklaps()
            )

            if laps.empty:
                continue

            q1 = laps[laps["SessionPart"] == "Q1"]
            q2 = laps[laps["SessionPart"] == "Q2"]
            q3 = laps[laps["SessionPart"] == "Q3"]

            output.append({

                "driver": driver,

                "q1": float(q1["LapTime"].dt.total_seconds().min()) if not q1.empty else None,

                "q2": float(q2["LapTime"].dt.total_seconds().min()) if not q2.empty else None,

                "q3": float(q3["LapTime"].dt.total_seconds().min()) if not q3.empty else None,

                "best": float(laps["LapTime"].dt.total_seconds().min())

            })

        return output


    # ==========================================================
    # STEP 67 — TELEMETRY STATISTICS
    # ==========================================================

    def get_telemetry_statistics(
        self,
        event_name,
        session_name,
        driver,
        lap_number
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name
        )

        session.load()

        lap = (
            session.laps
            .pick_drivers(driver)
            .pick_laps(lap_number)
            .iloc[0]
        )

        telemetry = lap.get_car_data().add_distance()

        return {

            "max_speed": float(telemetry["Speed"].max()),

            "average_speed": float(telemetry["Speed"].mean()),

            "max_rpm": int(telemetry["RPM"].max()),

            "average_rpm": float(telemetry["RPM"].mean()),

            "average_throttle": float(telemetry["Throttle"].mean()),

            "brake_percentage": float(
                telemetry["Brake"].mean() * 100
            ),

            "drs_percentage": float(
                (telemetry["DRS"] > 0).mean() * 100
            ),

            "telemetry_samples": len(telemetry)

        }

    # ==========================================================
    # AVAILABLE LAPS
    # ==========================================================

    def get_available_laps(
        self,
        event_name,
        session_name,
        driver,
    ):

        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        laps = (
            session.laps
            .pick_drivers(driver)
            .copy()
        )

        lap_numbers = (
            laps["LapNumber"]
            .dropna()
            .astype(int)
            .tolist()
        )

        return {
            "season": 2025,
            "event_name": event_name,
            "session_name": session_name,
            "driver": driver,
            "total_laps": len(lap_numbers),
            "laps": lap_numbers,
        }
    
    


    def get_sector_comparison(
        self,
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    ):
        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        result = []

        for driver in [driver1, driver2]:

            laps = (
                session.laps
                .pick_drivers(driver)
                .copy()
            )

            laps = laps[
                laps["LapNumber"] == lap_number
            ]

            if laps.empty:
                continue

            lap = laps.iloc[0]

            def secs(value):
                if pd.isna(value):
                    return None
                return float(value.total_seconds())

            result.append(
                {
                    "driver": driver,
                    "sector1": secs(lap["Sector1Time"]),
                    "sector2": secs(lap["Sector2Time"]),
                    "sector3": secs(lap["Sector3Time"]),
                    "lap_time": secs(lap["LapTime"]),
                }
            )

        return result
    
    def get_corner_analysis(
        self,
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    ):
        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        result = []

        for driver in [driver1, driver2]:

            lap = (
                session.laps
                .pick_drivers(driver)
                .pick_laps(lap_number)
                .iloc[0]
            )

            telemetry = (
                lap.get_telemetry()
                .add_distance()
            )

            corners = []

            for _, row in session.get_circuit_info().corners.iterrows():

                distance = row["Distance"]

                nearest = telemetry.iloc[
                    (
                        telemetry["Distance"] - distance
                    ).abs().argmin()
                ]

                corners.append(
                    {
                        "corner": int(row["Number"]),
                        "letter": (
                            ""
                            if pd.isna(row["Letter"])
                            else str(row["Letter"])
                        ),
                        "distance": float(distance),
                        "speed": float(nearest["Speed"]),
                        "gear": int(nearest["nGear"]),
                        "throttle": float(nearest["Throttle"]),
                        "brake": bool(nearest["Brake"]),
                    }
                )

            result.append(
                {
                    "driver": driver,
                    "corners": corners,
                }
            )

        return result
    
    def get_top_speed_analysis(
        self,
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    ):
        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        result = []

        for driver in [driver1, driver2]:

            lap = (
                session.laps
                .pick_drivers(driver)
                .pick_laps(lap_number)
                .iloc[0]
            )

            telemetry = lap.get_telemetry()

            max_speed = float(
                telemetry["Speed"].max()
            )

            avg_speed = float(
                telemetry["Speed"].mean()
            )

            min_speed = float(
                telemetry["Speed"].min()
            )

            max_speed_point = telemetry.loc[
                telemetry["Speed"].idxmax()
            ]

            result.append(
                {
                    "driver": driver,
                    "top_speed": max_speed,
                    "average_speed": avg_speed,
                    "minimum_speed": min_speed,
                    "distance_of_top_speed": float(
                        max_speed_point["Distance"]
                    ),
                    "rpm_at_top_speed": float(
                        max_speed_point["RPM"]
                    ),
                    "gear_at_top_speed": int(
                        max_speed_point["nGear"]
                    ),
                    "drs_at_top_speed": int(
                        max_speed_point["DRS"]
                    ),
                }
            )

        return result
    
    def get_acceleration_analysis(
        self,
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    ):
        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        result = []

        for driver in [driver1, driver2]:

            lap = (
                session.laps
                .pick_drivers(driver)
                .pick_laps(lap_number)
                .iloc[0]
            )

            telemetry = (
                lap.get_telemetry()
                .add_distance()
            ).copy()

            telemetry["Acceleration"] = (
                telemetry["Speed"]
                .diff()
                /
                telemetry["Time"]
                .diff()
                .dt.total_seconds()
            )

            telemetry["Acceleration"] = (
                telemetry["Acceleration"]
                .fillna(0)
            )

            max_row = telemetry.loc[
                telemetry["Acceleration"].idxmax()
            ]

            avg_acc = float(
                telemetry["Acceleration"].mean()
            )

            result.append(
                {
                    "driver": driver,
                    "maximum_acceleration": float(
                        max_row["Acceleration"]
                    ),
                    "average_acceleration": avg_acc,
                    "speed_at_max_acceleration": float(
                        max_row["Speed"]
                    ),
                    "distance_at_max_acceleration": float(
                        max_row["Distance"]
                    ),
                    "gear": int(
                        max_row["nGear"]
                    ),
                    "throttle": float(
                        max_row["Throttle"]
                    ),
                }
            )

        return result
    
    def get_braking_analysis(
        self,
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    ):
        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        result = []

        for driver in [driver1, driver2]:

            lap = (
                session.laps
                .pick_drivers(driver)
                .pick_laps(lap_number)
                .iloc[0]
            )

            telemetry = (
                lap.get_telemetry()
                .add_distance()
            ).copy()

            brake_points = telemetry[
                telemetry["Brake"] == True
            ]

            if brake_points.empty:
                result.append(
                    {
                        "driver": driver,
                        "total_braking_points": 0,
                        "maximum_braking_speed": 0,
                        "average_braking_speed": 0,
                        "first_braking_distance": 0,
                    }
                )
                continue

            result.append(
                {
                    "driver": driver,
                    "total_braking_points": int(
                        len(brake_points)
                    ),
                    "maximum_braking_speed": float(
                        brake_points["Speed"].max()
                    ),
                    "average_braking_speed": float(
                        brake_points["Speed"].mean()
                    ),
                    "first_braking_distance": float(
                        brake_points.iloc[0]["Distance"]
                    ),
                }
            )

        return result
    
    def get_drs_analysis(
        self,
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    ):
        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        result = []

        for driver in [driver1, driver2]:

            lap = (
                session.laps
                .pick_drivers(driver)
                .pick_laps(lap_number)
                .iloc[0]
            )

            telemetry = (
                lap.get_telemetry()
                .add_distance()
            ).copy()

            drs_open = telemetry[
                telemetry["DRS"] > 0
            ]

            if drs_open.empty:
                result.append(
                    {
                        "driver": driver,
                        "drs_samples": 0,
                        "drs_percentage": 0.0,
                        "max_speed_with_drs": 0.0,
                        "average_speed_with_drs": 0.0,
                    }
                )
                continue

            result.append(
                {
                    "driver": driver,
                    "drs_samples": int(len(drs_open)),
                    "drs_percentage": round(
                        len(drs_open) / len(telemetry) * 100,
                        2,
                    ),
                    "max_speed_with_drs": float(
                        drs_open["Speed"].max()
                    ),
                    "average_speed_with_drs": float(
                        drs_open["Speed"].mean()
                    ),
                }
            )

        return result
    
    def get_consistency_analysis(
        self,
        event_name,
        session_name,
        driver1,
        driver2,
    ):
        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        result = []

        for driver in [driver1, driver2]:

            laps = (
                session.laps
                .pick_drivers(driver)
                .pick_quicklaps()
                .copy()
            )

            lap_times = (
                laps["LapTime"]
                .dropna()
                .dt.total_seconds()
            )

            if lap_times.empty:
                result.append(
                    {
                        "driver": driver,
                        "lap_count": 0,
                        "average_lap": None,
                        "fastest_lap": None,
                        "slowest_lap": None,
                        "standard_deviation": None,
                        "consistency_score": None,
                    }
                )
                continue

            std = float(lap_times.std())

            consistency = max(
                0.0,
                100.0 - std * 10,
            )

            result.append(
                {
                    "driver": driver,
                    "lap_count": int(len(lap_times)),
                    "average_lap": float(lap_times.mean()),
                    "fastest_lap": float(lap_times.min()),
                    "slowest_lap": float(lap_times.max()),
                    "standard_deviation": std,
                    "consistency_score": round(
                        consistency,
                        2,
                    ),
                }
            )

        return result
    
    def get_performance_summary(
        self,
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    ):
        return {
            "sector_analysis": self.get_sector_comparison(
                event_name,
                session_name,
                driver1,
                driver2,
                lap_number,
            ),
            "top_speed_analysis": self.get_top_speed_analysis(
                event_name,
                session_name,
                driver1,
                driver2,
                lap_number,
            ),
            "acceleration_analysis": self.get_acceleration_analysis(
                event_name,
                session_name,
                driver1,
                driver2,
                lap_number,
            ),
            "braking_analysis": self.get_braking_analysis(
                event_name,
                session_name,
                driver1,
                driver2,
                lap_number,
            ),
            "drs_analysis": self.get_drs_analysis(
                event_name,
                session_name,
                driver1,
                driver2,
                lap_number,
            ),
            "consistency_analysis": self.get_consistency_analysis(
                event_name,
                session_name,
                driver1,
                driver2,
            ),
        }
    
    def get_driver_performance_score(
        self,
        event_name,
        session_name,
        driver1,
        driver2,
        lap_number,
    ):
        summary = self.get_performance_summary(
            event_name,
            session_name,
            driver1,
            driver2,
            lap_number,
        )

        sectors = summary["sector_analysis"]
        top_speed = summary["top_speed_analysis"]
        acceleration = summary["acceleration_analysis"]
        braking = summary["braking_analysis"]
        drs = summary["drs_analysis"]
        consistency = summary["consistency_analysis"]

        scores = []

        for i in range(2):
            sector1 = sectors[i]["sector1"] or 0
            sector2 = sectors[i]["sector2"] or 0
            sector3 = sectors[i]["sector3"] or 0

            sector_score = (
                (100 - sector1)
                + (100 - sector2)
                + (100 - sector3)
            ) / 3

            speed_score = (top_speed[i]["top_speed"] or 0) / 4

            accel_score = (
                (acceleration[i]["average_acceleration"] or 0) * 10
            )

            brake_score = (
                (braking[i]["average_braking_speed"] or 0) / 2
            )

            drs_score = drs[i]["drs_percentage"] or 0

            consistency_score = consistency[i]["consistency_score"] or 0

            overall = (
                sector_score * 0.30
                + speed_score * 0.20
                + accel_score * 0.15
                + brake_score * 0.10
                + drs_score * 0.10
                + consistency_score * 0.15
            )

            overall = max(0, min(100, overall))

            scores.append(
                {
                    "driver": sectors[i]["driver"],
                    "score": round(overall, 1),
                }
            )

        return scores
    
    def get_driver_standings(self):
        url = "https://api.jolpi.ca/ergast/f1/2025/driverStandings.json"

        data = requests.get(url).json()

        standings = data["MRData"]["StandingsTable"]["StandingsLists"][0]["DriverStandings"]

        return [
            {
                "position": int(driver["position"]),
                "driver": driver["Driver"]["code"],
                "team": driver["Constructors"][0]["name"],
                "points": float(driver["points"]),
                "wins": int(driver["wins"]),
            }
            for driver in standings
        ]
    
    def get_constructor_standings(self):
        url = "https://api.jolpi.ca/ergast/f1/2025/constructorStandings.json"

        data = requests.get(url).json()

        standings = data["MRData"]["StandingsTable"]["StandingsLists"][0]["ConstructorStandings"]

        return [
            {
                "position": int(team["position"]),
                "team": team["Constructor"]["name"],
                "points": float(team["points"]),
            }
            for team in standings
        ]
    
    def get_race_control(
        self,
        event_name,
        session_name,
    ):
        session = fastf1.get_session(
            2025,
            event_name,
            session_name,
        )

        session.load()

        messages = session.race_control_messages

        if messages is None or messages.empty:
            return []

        results = []

        for _, row in messages.iterrows():
            results.append(
                {
                    "time": (
                        str(row["Time"])
                        if not pd.isna(row["Time"])
                        else None
                    ),
                    "category": (
                        row["Category"]
                        if not pd.isna(row["Category"])
                        else ""
                    ),
                    "message": (
                        row["Message"]
                        if not pd.isna(row["Message"])
                        else ""
                    ),
                    "status": (
                        row["Status"]
                        if "Status" in messages.columns
                        and not pd.isna(row["Status"])
                        else ""
                    ),
                    "flag": (
                        row["Flag"]
                        if "Flag" in messages.columns
                        and not pd.isna(row["Flag"])
                        else ""
                    ),
                    "scope": (
                        row["Scope"]
                        if "Scope" in messages.columns
                        and not pd.isna(row["Scope"])
                        else ""
                    ),
                }
            )

        return results