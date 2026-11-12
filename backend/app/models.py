import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
    Column,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    STUDENT = "student"
    PROFESSOR = "professor"


class OpportunityStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"


class ApplicationStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class OpportunityBulletType(str, enum.Enum):
    RESPONSIBILITY = "responsibility"
    GOAL = "goal"
    PREREQUISITE = "prerequisite"


def stored_enum_values(enum_type: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_type]


opportunity_research_areas = Table(
    "opportunity_research_areas",
    Base.metadata,
    Column("opportunity_id", Uuid(as_uuid=True), ForeignKey("opportunities.id", ondelete="CASCADE"), primary_key=True),
    Column("research_area_id", Uuid(as_uuid=True), ForeignKey("research_areas.id", ondelete="RESTRICT"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False, length=16, values_callable=stored_enum_values),
        nullable=False,
        default=UserRole.STUDENT,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    student_profile: Mapped["StudentProfile | None"] = relationship(back_populates="user", uselist=False)
    professor_profile: Mapped["ProfessorProfile | None"] = relationship(back_populates="user", uselist=False)


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    major: Mapped[str] = mapped_column(String(160), nullable=False)
    year_in_school: Mapped[str | None] = mapped_column(String(40))
    about: Mapped[str | None] = mapped_column(Text)
    photo_object_key: Mapped[str | None] = mapped_column(String(512))
    resume_object_key: Mapped[str | None] = mapped_column(String(512))
    resume_file_name: Mapped[str | None] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="student_profile")
    applications: Mapped[list["Application"]] = relationship(back_populates="student")


class ProfessorProfile(Base):
    __tablename__ = "professor_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    title: Mapped[str | None] = mapped_column(String(120))
    department: Mapped[str] = mapped_column(String(160), nullable=False)
    about: Mapped[str | None] = mapped_column(Text)
    photo_object_key: Mapped[str | None] = mapped_column(String(512))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="professor_profile")
    opportunities: Mapped[list["Opportunity"]] = relationship(back_populates="professor")


class ResearchArea(Base):
    __tablename__ = "research_areas"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    opportunities: Mapped[list["Opportunity"]] = relationship(
        secondary=opportunity_research_areas, back_populates="research_areas"
    )


class Opportunity(Base):
    __tablename__ = "opportunities"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_opportunities_slug"),
        CheckConstraint("weekly_hours_min > 0", name="ck_opportunities_hours_min_positive"),
        CheckConstraint("weekly_hours_max >= weekly_hours_min", name="ck_opportunities_hours_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(180), nullable=False)
    professor_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("professor_profiles.user_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    duration: Mapped[str] = mapped_column(String(120), nullable=False)
    weekly_hours_min: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    weekly_hours_max: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    application_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[OpportunityStatus] = mapped_column(
        Enum(OpportunityStatus, native_enum=False, length=16, values_callable=stored_enum_values),
        nullable=False,
        default=OpportunityStatus.DRAFT,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    detail_items: Mapped[list["OpportunityBullet"]] = relationship(
        back_populates="opportunity", cascade="all, delete-orphan", order_by="OpportunityBullet.sort_order"
    )
    professor: Mapped[ProfessorProfile] = relationship(back_populates="opportunities")
    research_areas: Mapped[list[ResearchArea]] = relationship(
        secondary=opportunity_research_areas, back_populates="opportunities"
    )
    applications: Mapped[list["Application"]] = relationship(back_populates="opportunity")


class OpportunityBullet(Base):
    __tablename__ = "opportunity_bullets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[OpportunityBulletType] = mapped_column(
        Enum(OpportunityBulletType, native_enum=False, length=24, values_callable=stored_enum_values),
        nullable=False,
    )
    text: Mapped[str] = mapped_column(String(1000), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    opportunity: Mapped[Opportunity] = relationship(back_populates="detail_items")


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("student_user_id", "opportunity_id", name="uq_applications_student_opportunity"),
        CheckConstraint(
            "(status = 'submitted' AND decision_at IS NULL AND decision_reason IS NULL) OR "
            "(status = 'accepted' AND decision_at IS NOT NULL AND decision_reason IS NULL) OR "
            "(status = 'declined' AND decision_at IS NOT NULL AND decision_reason IS NOT NULL)",
            name="ck_applications_decision_fields",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("student_profiles.user_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("opportunities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    interest_statement: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, native_enum=False, length=16, values_callable=stored_enum_values),
        nullable=False,
        default=ApplicationStatus.SUBMITTED,
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    decision_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_reason: Mapped[str | None] = mapped_column(Text)

    student: Mapped[StudentProfile] = relationship(back_populates="applications")
    opportunity: Mapped[Opportunity] = relationship(back_populates="applications")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("opportunities.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    participants: Mapped[list["ConversationParticipant"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.sent_at"
    )


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    conversation: Mapped[Conversation] = relationship(back_populates="participants")
    user: Mapped[User] = relationship()


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    sender: Mapped[User] = relationship()
