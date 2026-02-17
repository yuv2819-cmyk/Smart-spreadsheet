import asyncio
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status

_WINDOWS: dict[str, deque[float]] = defaultdict(deque)
_LOCK = asyncio.Lock()


def rate_limit(*, key_prefix: str, limit: int, window_seconds: int) -> Callable:
    async def _limiter(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"{key_prefix}:{client_ip}"
        now = time.time()
        cutoff = now - window_seconds

        async with _LOCK:
            bucket = _WINDOWS[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= limit:
                retry_after = int(max(1, window_seconds - (now - bucket[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded.",
                    headers={"Retry-After": str(retry_after)},
                )

            bucket.append(now)

    return _limiter
