from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.config import Settings
from backend.app.database import create_database_engine, create_session_factory
from backend.app.models import (
    Base,
    Opportunity,
    OpportunityStatus,
    ProfessorProfile,
    ResearchArea,
    User,
    UserRole,
)
from backend.app.security import hash_password

SAMPLE_OPPORTUNITIES = [
    {
        "slug": "climate-resilience-urban-communities",
        "title": "Climate Resilience in Urban Communities",
        "department": "Geography & Earth Sciences",
        "faculty": "Dr. Maya Thompson",
        "description": "Study how neighborhoods adapt to extreme heat and changing weather through community data and field research.",
        "areas": ["Climate", "Community research"],
        "posted": datetime(2026, 10, 28, tzinfo=UTC),
        "deadline": datetime(2026, 12, 5, tzinfo=UTC),
        "duration": "One semester",
        "hours_min": Decimal("5"),
        "hours_max": Decimal("8"),
    },
    {
        "slug": "ai-tools-accessible-learning",
        "title": "AI Tools for Accessible Learning",
        "department": "Computer Science",
        "faculty": "Dr. Daniel Kim",
        "description": "Explore how thoughtful AI tools can make course materials and learning experiences more accessible to every student.",
        "areas": ["Artificial intelligence", "Accessibility"],
        "posted": datetime(2026, 10, 24, tzinfo=UTC),
        "deadline": datetime(2026, 11, 30, tzinfo=UTC),
        "duration": "One semester",
        "hours_min": Decimal("6"),
        "hours_max": Decimal("6"),
    },
    {
        "slug": "water-quality-catawba-river",
        "title": "Water Quality in the Catawba River",
        "department": "Biological Sciences",
        "faculty": "Dr. Olivia Reed",
        "description": "Collect and analyze water samples to understand the health of local waterways and surrounding ecosystems.",
        "areas": ["Environment", "Fieldwork"],
        "posted": datetime(2026, 10, 20, tzinfo=UTC),
        "deadline": datetime(2026, 12, 12, tzinfo=UTC),
        "duration": "One semester",
        "hours_min": Decimal("4"),
        "hours_max": Decimal("6"),
    },
    {
        "slug": "stories-migration-american-south",
        "title": "Stories of Migration in the American South",
        "department": "History",
        "faculty": "Dr. Javier Morales",
        "description": "Help build a digital archive of oral histories documenting migration and community life across the region.",
        "areas": ["History", "Digital humanities"],
        "posted": datetime(2026, 10, 16, tzinfo=UTC),
        "deadline": datetime(2026, 11, 25, tzinfo=UTC),
        "duration": "One semester",
        "hours_min": Decimal("5"),
        "hours_max": Decimal("5"),
    },
    {
        "slug": "community-health-food-access",
        "title": "Community Health and Food Access",
        "department": "Public Health Sciences",
        "faculty": "Dr. Aisha Patel",
        "description": "Partner with local organizations to map food access and understand its relationship to community health.",
        "areas": ["Public health", "Community research"],
        "posted": datetime(2026, 10, 10, tzinfo=UTC),
        "deadline": datetime(2026, 12, 18, tzinfo=UTC),
        "duration": "One semester",
        "hours_min": Decimal("6"),
        "hours_max": Decimal("8"),
    },
    {
        "slug": "robotics-sustainable-agriculture",
        "title": "Robotics for Sustainable Agriculture",
        "department": "Mechanical Engineering",
        "faculty": "Dr. Noah Williams",
        "description": "Prototype small-scale robotic systems that help growers monitor crops and use resources efficiently.",
        "areas": ["Robotics", "Sustainability"],
        "posted": datetime(2026, 10, 4, tzinfo=UTC),
        "deadline": datetime(2027, 1, 8, tzinfo=UTC),
        "duration": "One semester",
        "hours_min": Decimal("8"),
        "hours_max": Decimal("8"),
    },
]


def seed_demo_opportunities(db: Session) -> None:
    areas_by_name = {
        area.name: area for area in db.scalars(select(ResearchArea)).all()
    }
    for sample in SAMPLE_OPPORTUNITIES:
        if db.scalar(select(Opportunity.id).where(Opportunity.slug == sample["slug"])) is not None:
            continue

        professor_user = User(
            email=f"demo-{sample['slug']}@example.invalid",
            password_hash=hash_password(uuid4().hex + uuid4().hex),
            role=UserRole.PROFESSOR,
        )
        professor_user.professor_profile = ProfessorProfile(
            full_name=sample["faculty"],
            department=sample["department"],
        )
        opportunity = Opportunity(
            slug=sample["slug"],
            title=sample["title"],
            description=sample["description"],
            duration=sample["duration"],
            weekly_hours_min=sample["hours_min"],
            weekly_hours_max=sample["hours_max"],
            application_deadline=sample["deadline"],
            status=OpportunityStatus.PUBLISHED,
            created_at=sample["posted"],
            published_at=sample["posted"],
            professor=professor_user.professor_profile,
        )
        for area_name in sample["areas"]:
            area = areas_by_name.get(area_name)
            if area is None:
                area = ResearchArea(name=area_name)
                areas_by_name[area_name] = area
                db.add(area)
            opportunity.research_areas.append(area)
        db.add(opportunity)
    db.commit()


def main() -> None:
    settings = Settings()
    engine = create_database_engine(settings.database_url)
    session_factory = create_session_factory(engine)
    with session_factory() as session:
        seed_demo_opportunities(session)
    engine.dispose()


if __name__ == "__main__":
    main()
