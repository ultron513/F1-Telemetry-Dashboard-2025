"""Domain errors and their HTTP translation."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

log = logging.getLogger("pitwall.errors")


class DomainError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, hint: str | None = None):
        super().__init__(message)
        self.message = message
        self.hint = hint


class NotFoundError(DomainError):
    status_code = 404
    code = "not_found"


class InvalidParameterError(DomainError):
    status_code = 422
    code = "invalid_parameter"


class DataUnavailableError(DomainError):
    """Upstream timing data is missing or could not be fetched."""

    status_code = 503
    code = "data_unavailable"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "hint": exc.hint,
                }
            },
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "Something went wrong while processing timing data.",
                    "hint": None,
                }
            },
        )
