from __future__ import annotations

from app.schemas.common import Model


class ChampionDriver(Model):
    id: str
    name: str
    nationality: str | None = None
    points: float
    wins: int
    team: str | None = None


class ChampionTeam(Model):
    id: str
    name: str
    points: float
    wins: int


class ChampionSeason(Model):
    season: int
    rounds: int
    decided: bool
    driver: ChampionDriver
    constructor: ChampionTeam | None = None


class TitleCount(Model):
    name: str
    titles: int


class ChampionsResponse(Model):
    seasons: list[ChampionSeason]
    most_driver_titles: list[TitleCount]
    most_constructor_titles: list[TitleCount]


class HistoryDriver(Model):
    id: str
    name: str
    code: str | None = None
    number: str | None = None
    nationality: str | None = None
    born: str | None = None
    wiki: str | None = None


class DriversResponse(Model):
    drivers: list[HistoryDriver]


class CareerTotals(Model):
    starts: int
    wins: int
    podiums: int
    poles: int
    fastest_laps: int
    points: float
    dnfs: int
    titles: int
    title_years: list[int]
    best_finish: int | None = None
    win_rate: float
    podium_rate: float


class RaceRef(Model):
    season: int
    name: str


class CareerSeason(Model):
    season: int
    races: int
    wins: int
    podiums: int
    poles: int
    points: float
    teams: list[str]
    championship: int | None = None


class CareerResponse(Model):
    driver: HistoryDriver
    totals: CareerTotals
    first_race: RaceRef | None = None
    last_race: RaceRef | None = None
    teams: list[dict]
    seasons: list[CareerSeason]


class HistoryCircuit(Model):
    id: str
    name: str
    locality: str | None = None
    country: str | None = None
    lat: float | None = None
    long: float | None = None
    wiki: str | None = None


class CircuitsResponse(Model):
    circuits: list[HistoryCircuit]


class WinCount(Model):
    name: str
    wins: int


class PoleTime(Model):
    season: int
    driver: str
    team: str
    time: float | None = None


class CircuitRace(Model):
    season: int
    round: int
    race: str
    winner: str
    winner_id: str
    team: str
    grid: int | None = None
    pole: str | None = None
    pole_time: float | None = None
    fastest_lap: float | None = None


class CircuitHistoryResponse(Model):
    circuit: HistoryCircuit
    races: int
    first: int | None = None
    last: int | None = None
    wins_from_pole: int
    pole_win_rate: float | None = None
    most_wins: list[WinCount]
    most_team_wins: list[WinCount]
    pole_record: PoleTime | None = None
    pole_times: list[PoleTime]
    results: list[CircuitRace]
