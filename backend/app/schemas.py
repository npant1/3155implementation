from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from backend.app.models import ApplicationStatus, OpportunityBulletType, OpportunityStatus, UserRole


class StudentRegistration(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(min_length=2, max_length=160)
    major: str = Field(min_length=2, max_length=160)

    @field_validator("full_name", "major")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("This field must contain at least two non-space characters.")
        return normalized


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class StudentProfileOut(BaseModel):
    full_name: str
    major: str
    year_in_school: str | None
    about: str | None

    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    role: UserRole
    student_profile: StudentProfileOut | None

    model_config = ConfigDict(from_attributes=True)


class OpportunityOut(BaseModel):
    id: UUID
    slug: str
    title: str
    department: str
    faculty: str
    description: str
    areas: list[str]
    posted: date
    deadline: date
    duration: str
    weekly_hours_min: Decimal
    weekly_hours_max: Decimal
    responsibilities: list[str]
    goals: list[str]
    prerequisites: list[str]
    status: OpportunityStatus


class ApplicationCreate(BaseModel):
    interest_statement: str = Field(min_length=10, max_length=5000)

    @field_validator("interest_statement")
    @classmethod
    def strip_interest_statement(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 10:
            raise ValueError("The interest statement must contain at least 10 non-space characters.")
        return normalized


class ApplicationOut(BaseModel):
    id: UUID
    opportunity_id: UUID
    status: ApplicationStatus
    submitted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OpportunityBulletCreate(BaseModel):
    type: OpportunityBulletType
    text: str = Field(min_length=1, max_length=1000)
    sort_order: int = Field(default=0, ge=0)


class OpportunityCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=10000)
    duration: str = Field(min_length=1, max_length=120)
    weekly_hours_min: Decimal = Field(gt=0, le=168)
    weekly_hours_max: Decimal = Field(gt=0, le=168)
    application_deadline: datetime
    areas: list[str] = Field(min_length=1, max_length=10)
    detail_items: list[OpportunityBulletCreate] = Field(default_factory=list, max_length=60)

    @model_validator(mode="after")
    def validate_hours(self) -> "OpportunityCreate":
        if self.weekly_hours_max < self.weekly_hours_min:
            raise ValueError("weekly_hours_max must be greater than or equal to weekly_hours_min")
        return self
