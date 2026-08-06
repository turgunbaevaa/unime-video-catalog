"""Shared FastAPI dependencies (auth placeholders, etc.)."""

from fastapi import Request


async def verify_admin(request: Request) -> None:
    """
    Administrator verification placeholder.
    Wire Authorization / Entra ID checks here before production.
    """
    # auth_header = request.headers.get("Authorization")
    # if not auth_header:
    #     raise HTTPException(status_code=401, detail="Unauthorized")
    _ = request
