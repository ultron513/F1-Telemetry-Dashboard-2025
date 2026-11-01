"""Python client for the Pit Wall API.

>>> from pitwall_client import PitWall
>>> pw = PitWall("http://localhost:8000")
>>> race = pw.session(2025, 3, "R")
>>> race.summary()["event"]["name"]
'Japanese Grand Prix'
>>> race.compare("VER", "NOR")["final_delta"]
"""

from pitwall_client.client import ApiError, AsyncPitWall, PitWall, SessionClient

__all__ = ["ApiError", "AsyncPitWall", "PitWall", "SessionClient"]
__version__ = "0.1.0"
