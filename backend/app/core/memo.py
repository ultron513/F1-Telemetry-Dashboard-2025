"""A small thread-safe LRU + TTL memoiser for derived payloads.

FastF1 sessions are expensive to *load*; once loaded, the heavy work is
reshaping them into JSON-friendly payloads. Those payloads are small and
deterministic for a given argument tuple, so they are cached here.
"""

from __future__ import annotations

import functools
import threading
import time
from collections import OrderedDict
from collections.abc import Callable, Hashable
from typing import Any, TypeVar

F = TypeVar("F", bound=Callable[..., Any])

_MISSING = object()


class TTLCache:
    def __init__(self, maxsize: int, ttl: float):
        self.maxsize = maxsize
        self.ttl = ttl
        self._data: OrderedDict[Hashable, tuple[float, Any]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: Hashable) -> Any:
        with self._lock:
            item = self._data.get(key, _MISSING)
            if item is _MISSING:
                return _MISSING
            stamp, value = item
            if time.monotonic() - stamp > self.ttl:
                del self._data[key]
                return _MISSING
            self._data.move_to_end(key)
            return value

    def set(self, key: Hashable, value: Any) -> None:
        with self._lock:
            self._data[key] = (time.monotonic(), value)
            self._data.move_to_end(key)
            while len(self._data) > self.maxsize:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def __len__(self) -> int:
        return len(self._data)


_registry: list[TTLCache] = []


def memoize(maxsize: int = 256, ttl: float = 3600) -> Callable[[F], F]:
    """Memoise a function on its positional + keyword arguments."""

    def decorator(fn: F) -> F:
        cache = TTLCache(maxsize, ttl)
        _registry.append(cache)
        key_locks: dict[Hashable, threading.Lock] = {}
        guard = threading.Lock()

        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            key = (args, tuple(sorted(kwargs.items())))
            hit = cache.get(key)
            if hit is not _MISSING:
                return hit
            with guard:
                lock = key_locks.setdefault(key, threading.Lock())
            with lock:
                hit = cache.get(key)
                if hit is not _MISSING:
                    return hit
                value = fn(*args, **kwargs)
                cache.set(key, value)
            with guard:
                key_locks.pop(key, None)
            return value

        wrapper.cache = cache  # type: ignore[attr-defined]
        return wrapper  # type: ignore[return-value]

    return decorator


def clear_all() -> None:
    for cache in _registry:
        cache.clear()
