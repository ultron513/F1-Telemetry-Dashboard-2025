"""Formula 1 history since 1950 (Jolpica / Ergast data, cached on disk)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.schemas.history import (
    CareerResponse,
    ChampionsResponse,
    CircuitHistoryResponse,
    CircuitsResponse,
    DriversResponse,
)
from app.services import history

router = APIRouter(prefix="/history", tags=["History"])

Id = Annotated[str, Path(min_length=2, max_length=60, pattern=r"^[a-z0-9_]+$")]


@router.get(
    "/champions", response_model=ChampionsResponse, summary="Every world champion since 1950"
)
def champions() -> dict:
    return history.champions()


@router.get(
    "/drivers",
    response_model=DriversResponse,
    summary="Every driver who started a championship race",
)
def drivers(search: Annotated[str, Query(max_length=40)] = "") -> dict:
    return {"drivers": history.drivers(search)}


@router.get("/drivers/{driver_id}", response_model=CareerResponse, summary="A driver's career")
def driver(driver_id: Id) -> dict:
    return history.driver_career(driver_id)


@router.get("/circuits", response_model=CircuitsResponse, summary="Every circuit used since 1950")
def circuits() -> dict:
    return {"circuits": history.circuits()}


@router.get(
    "/circuits/{circuit_id}",
    response_model=CircuitHistoryResponse,
    summary="Winners, poles and pole-time evolution at a circuit",
)
def circuit(circuit_id: Id) -> dict:
    return history.circuit_history(circuit_id)
