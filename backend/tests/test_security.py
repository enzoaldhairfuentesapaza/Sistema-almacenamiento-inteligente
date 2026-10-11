from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Request

from app.core.security import current_user


@pytest.mark.parametrize("offset,hours,valid", [(-5, 1, True), (5, -1, False)])
def test_session_expiry_respects_timestamp_offset(offset, hours, valid):
    user = SimpleNamespace(activo=True)
    session = SimpleNamespace(
        usuario_id=1,
        expira=(datetime.now(timezone.utc) + timedelta(hours=hours)).astimezone(
            timezone(timedelta(hours=offset))
        ),
    )

    class Database:
        def scalar(self, query):
            return session

        def get(self, model, id):
            return user

    request = Request(
        {"type": "http", "method": "GET", "headers": [(b"cookie", b"almacen_session=test-token")]}
    )
    if valid:
        assert current_user(request, Database()) is user
        assert request.state.auth_session is session
    else:
        with pytest.raises(HTTPException) as error:
            current_user(request, Database())
        assert error.value.status_code == 401
