from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMe(BaseModel):
    id: int
    username: str
    is_admin: bool
    is_active: bool

    class Config:
        from_attributes = True
