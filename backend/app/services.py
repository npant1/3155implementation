from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from backend.app.models import (
    Application,
    ApplicationStatus,
    Opportunity,
    OpportunityStatus,
    StudentProfile,
    User,
    UserRole,
)
from backend.app.schemas import ApplicationCreate


def get_student_profile(db: Session, user_id: UUID) -> StudentProfile:
    profile = db.get(StudentProfile, user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A student profile is required.")
    return profile


def submit_application(
    db: Session,
    student: User,
    opportunity_id: UUID,
    payload: ApplicationCreate,
) -> Application:
    if student.role is not UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only student accounts may apply.")

    opportunity = db.scalar(
        select(Opportunity)
        .options(joinedload(Opportunity.professor))
        .where(Opportunity.id == opportunity_id)
    )
    if opportunity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found.")
    if opportunity.status is not OpportunityStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This opportunity is not accepting applications.")

    deadline = opportunity.application_deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=UTC)
    if deadline <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The application deadline has passed.")

    get_student_profile(db, student.id)
    duplicate = db.scalar(
        select(Application.id).where(
            Application.student_user_id == student.id,
            Application.opportunity_id == opportunity.id,
        )
    )
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already applied to this opportunity.")

    application = Application(
        student_user_id=student.id,
        opportunity_id=opportunity.id,
        interest_statement=payload.interest_statement.strip(),
        status=ApplicationStatus.SUBMITTED,
    )
    db.add(application)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An application for this opportunity already exists.",
        ) from error
    db.refresh(application)
    return application
