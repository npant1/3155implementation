def test_student_can_register_and_submit_once(client):
    registration = client.post(
        "/api/auth/register",
        json={
            "email": "student@example.edu",
            "password": "a-strong-prototype-password",
            "full_name": "Test Student",
            "major": "Environmental Studies",
        },
    )
    assert registration.status_code == 201
    assert registration.json()["student_profile"]["full_name"] == "Test Student"
    assert client.cookies.get("research_session")

    opportunities = client.get("/api/opportunities")
    assert opportunities.status_code == 200
    opportunity = next(
        item for item in opportunities.json() if item["slug"] == "climate-resilience-urban-communities"
    )

    application = client.post(
        f"/api/opportunities/{opportunity['id']}/applications",
        json={"interest_statement": "I want to contribute to the climate research project."},
    )
    assert application.status_code == 201
    assert application.json()["status"] == "submitted"
    assert application.json()["opportunity_id"] == opportunity["id"]

    duplicate = client.post(
        f"/api/opportunities/{opportunity['id']}/applications",
        json={"interest_statement": "I want to contribute to the climate research project."},
    )
    assert duplicate.status_code == 409
    assert client.get("/api/applications/mine").json()[0]["id"] == application.json()["id"]


def test_applications_require_an_authenticated_student(client):
    opportunity = client.get("/api/opportunities").json()[0]
    response = client.post(
        f"/api/opportunities/{opportunity['id']}/applications",
        json={"interest_statement": "I want to contribute to this project."},
    )
    assert response.status_code == 401


def test_session_endpoint_returns_empty_for_a_signed_out_visitor(client):
    response = client.get("/api/auth/session")
    assert response.status_code == 200
    assert response.json() is None


def test_session_endpoint_restores_signed_in_student(client, student_account):
    response = client.get("/api/auth/session")
    assert response.status_code == 200
    assert response.json()["id"] == student_account["id"]
    assert response.json()["student_profile"]["major"] == "Environmental Studies"


def test_registration_validates_email_and_password_length(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "not-an-email",
            "password": "short",
            "full_name": "Test Student",
            "major": "Biology",
        },
    )
    assert response.status_code == 422


def test_application_rejects_a_blank_interest_statement(client, student_account):
    opportunity = client.get("/api/opportunities").json()[0]
    response = client.post(
        f"/api/opportunities/{opportunity['id']}/applications",
        json={"interest_statement": "          "},
    )
    assert response.status_code == 422


def test_session_is_cleared_on_logout(client, student_account):
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_closed_opportunity_rejects_applications(client, student_account):
    from sqlalchemy import select

    from backend.app.models import Opportunity, OpportunityStatus

    app = client.app
    with app.state.session_factory() as session:
        opportunity = session.scalar(
            select(Opportunity).where(Opportunity.slug == "climate-resilience-urban-communities")
        )
        opportunity.status = OpportunityStatus.CLOSED
        session.commit()
        opportunity_id = opportunity.id

    response = client.post(
        f"/api/opportunities/{opportunity_id}/applications",
        json={"interest_statement": "I want to contribute to this project."},
    )
    assert response.status_code == 409
