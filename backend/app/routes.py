from datetime import datetime
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from backend.app.config import Settings
from backend.app.database import get_db
from backend.app.models import (
    Application,
    Opportunity,
    OpportunityBulletType,
    OpportunityStatus,
    StudentProfile,
    User,
    UserRole,
)
from backend.app.schemas import (
    ApplicationCreate,
    ApplicationOut,
    LoginRequest,
    OpportunityOut,
    StudentRegistration,
    UserOut,
)
from backend.app.security import create_access_token, hash_password, read_access_token, verify_password
from backend.app.services import submit_application

router = APIRouter(prefix="/api")
AUTH_COOKIE = "research_session"


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> User:
    token = request.cookies.get(AUTH_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue.")
    try:
        user_id = read_access_token(token, settings)
    except (jwt.InvalidTokenError, ValueError, KeyError) as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your session is invalid or expired.") from error
    user = db.scalar(
        select(User).options(joinedload(User.student_profile)).where(User.id == user_id)
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your account is no longer available.")
    return user


def set_session_cookie(response: Response, user: User, settings: Settings) -> None:
    response.set_cookie(
        AUTH_COOKIE,
        create_access_token(user.id, settings),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        max_age=settings.session_ttl_minutes * 60,
        path="/",
    )


def as_opportunity(opportunity: Opportunity) -> OpportunityOut:
    profile = opportunity.professor
    items = {kind: [] for kind in OpportunityBulletType}
    for item in opportunity.detail_items:
        items[item.type].append(item.text)
    return OpportunityOut(
        id=opportunity.id,
        slug=opportunity.slug,
        title=opportunity.title,
        department=profile.department,
        faculty=profile.full_name,
        description=opportunity.description,
        areas=[area.name for area in opportunity.research_areas],
        posted=opportunity.created_at.date(),
        deadline=opportunity.application_deadline.date(),
        duration=opportunity.duration,
        weekly_hours_min=opportunity.weekly_hours_min,
        weekly_hours_max=opportunity.weekly_hours_max,
        responsibilities=items[OpportunityBulletType.RESPONSIBILITY],
        goals=items[OpportunityBulletType.GOAL],
        prerequisites=items[OpportunityBulletType.PREREQUISITE],
        status=opportunity.status,
    )


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    payload: StudentRegistration,
    response: Response,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> User:
    normalized_email = str(payload.email).strip().lower()
    if db.scalar(select(User.id).where(User.email == normalized_email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    user = User(email=normalized_email, password_hash=hash_password(payload.password), role=UserRole.STUDENT)
    user.student_profile = StudentProfile(full_name=payload.full_name.strip(), major=payload.major.strip())
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.") from error
    db.refresh(user)
    set_session_cookie(response, user, settings)
    return user


@router.post("/auth/login", response_model=UserOut)
def login(
    payload: LoginRequest,
    response: Response,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> User:
    normalized_email = str(payload.email).strip().lower()
    user = db.scalar(
        select(User).options(joinedload(User.student_profile)).where(User.email == normalized_email)
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect.")
    set_session_cookie(response, user, settings)
    return user


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, settings: Settings = Depends(get_settings)) -> Response:
    response.delete_cookie(
        AUTH_COOKIE,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/auth/me", response_model=UserOut)
def current_user(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("/auth/session", response_model=UserOut | None)
def read_session(
    request: Request,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> User | None:
    if AUTH_COOKIE not in request.cookies:
        return None
    return get_current_user(request, settings, db)


def opportunity_query():
    return (
        select(Opportunity)
        .options(
            joinedload(Opportunity.professor),
            selectinload(Opportunity.research_areas),
            selectinload(Opportunity.detail_items),
        )
    )


@router.get("/opportunities", response_model=list[OpportunityOut])
def list_opportunities(db: Session = Depends(get_db)) -> list[OpportunityOut]:
    opportunities = db.scalars(
        opportunity_query()
        .where(Opportunity.status == OpportunityStatus.PUBLISHED)
        .order_by(Opportunity.created_at.desc())
    ).unique().all()
    return [as_opportunity(item) for item in opportunities]


@router.get("/opportunities/{slug}", response_model=OpportunityOut)
def read_opportunity(slug: str, db: Session = Depends(get_db)) -> OpportunityOut:
    opportunity = db.scalar(
        opportunity_query().where(
            Opportunity.slug == slug,
            Opportunity.status == OpportunityStatus.PUBLISHED,
        )
    )
    if opportunity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found.")
    return as_opportunity(opportunity)


@router.post(
    "/opportunities/{opportunity_id}/applications",
    response_model=ApplicationOut,
    status_code=status.HTTP_201_CREATED,
)
def apply_to_opportunity(
    opportunity_id: UUID,
    payload: ApplicationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Application:
    return submit_application(db, user, opportunity_id, payload)


@router.get("/applications/mine", response_model=list[ApplicationOut])
def list_my_applications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Application]:
    if user.role is not UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only student accounts have applications.")
    return list(
        db.scalars(
            select(Application)
            .where(Application.student_user_id == user.id)
            .order_by(Application.submitted_at.desc())
        ).all()
    )
