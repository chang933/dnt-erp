from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_store_id
from app.models.app_setting import AppSetting
from pydantic import BaseModel
from typing import Any
import json

router = APIRouter()


class SettingValue(BaseModel):
    value: Any


@router.get("/{key}")
def get_setting(key: str, db: Session = Depends(get_db), store_id: int = Depends(get_store_id)):
    row = (
        db.query(AppSetting)
        .filter(AppSetting.key == key, AppSetting.store_id == store_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Setting not found")
    try:
        return {"key": key, "value": json.loads(row.value)}
    except Exception:
        return {"key": key, "value": row.value}


@router.put("/{key}")
def put_setting(
    key: str,
    body: SettingValue,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    row = (
        db.query(AppSetting)
        .filter(AppSetting.key == key, AppSetting.store_id == store_id)
        .first()
    )
    serialized = json.dumps(body.value, ensure_ascii=False)
    if row:
        row.value = serialized
    else:
        row = AppSetting(store_id=store_id, key=key, value=serialized)
        db.add(row)
    db.commit()
    return {"key": key, "value": body.value}
