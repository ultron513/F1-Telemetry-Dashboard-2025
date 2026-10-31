"""Helpers that turn pandas / numpy values into JSON-safe primitives."""

from __future__ import annotations

import math
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

import numpy as np
import pandas as pd


def is_missing(value: Any) -> bool:
    if value is None:
        return True
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def seconds(value: Any, digits: int = 3) -> float | None:
    """Timedelta / number -> seconds (rounded) or ``None``."""
    if is_missing(value):
        return None
    if isinstance(value, (pd.Timedelta, np.timedelta64)):
        value = pd.Timedelta(value).total_seconds()
    elif hasattr(value, "total_seconds"):
        value = value.total_seconds()
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(out) or math.isinf(out):
        return None
    return round(out, digits)


def num(value: Any, digits: int | None = 3) -> float | None:
    if is_missing(value):
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(out) or math.isinf(out):
        return None
    return round(out, digits) if digits is not None else out


def integer(value: Any) -> int | None:
    out = num(value, None)
    return int(out) if out is not None else None


def text(value: Any, default: str | None = None) -> str | None:
    if is_missing(value):
        return default
    out = str(value).strip()
    return out if out else default


def boolean(value: Any, default: bool = False) -> bool:
    if is_missing(value):
        return default
    return bool(value)


def hex_color(value: Any) -> str | None:
    raw = text(value)
    if not raw:
        return None
    raw = raw.lstrip("#")
    if len(raw) != 6:
        return None
    try:
        int(raw, 16)
    except ValueError:
        return None
    return f"#{raw.upper()}"


def iso_utc(value: Any) -> str | None:
    if is_missing(value):
        return None
    ts = pd.Timestamp(value)
    if ts.tzinfo is None:
        ts = ts.tz_localize(UTC)
    else:
        ts = ts.tz_convert(UTC)
    return ts.isoformat().replace("+00:00", "Z")


def now_utc() -> datetime:
    return datetime.now(UTC)


def round_list(values: Iterable[Any], digits: int = 2) -> list[float | None]:
    out: list[float | None] = []
    for v in values:
        out.append(num(v, digits))
    return out


def int_list(values: Iterable[Any]) -> list[int | None]:
    return [integer(v) for v in values]
