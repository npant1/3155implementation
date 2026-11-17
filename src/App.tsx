import { useState, type FormEvent } from "react";
import menuIcon from "./assets/menu.svg";

const dashboardActions = [
  { id: "profile", label: "Profile", icon: "profile" },
  { id: "applicants", label: "View Applicants", icon: "search" },
  { id: "posts", label: "Posts", icon: "posts" },
  { id: "logout", label: "Log Out", icon: "logout" },
] as const;

type DashboardAction = (typeof dashboardActions)[number];

function ActionIcon({ icon }: { icon: DashboardAction["icon"] }) {
  if (icon === "profile") {
    return (
      <svg aria-hidden="true" className="dashboard-icon" viewBox="0 0 48 48">
        <circle cx="24" cy="13" r="8" />
        <path d="M7.5 42v-4.5A10.5 10.5 0 0 1 18 27h12a10.5 10.5 0 0 1 10.5 10.5V42" />
      </svg>
    );
  }

  if (icon === "search") {
    return (
      <svg aria-hidden="true" className="dashboard-icon" viewBox="0 0 48 48">
        <circle cx="21" cy="21" r="16" />
        <path d="m33 33 11 11" />
      </svg>
    );
  }

  if (icon === "posts") {
    return (
      <svg aria-hidden="true" className="dashboard-icon" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" />
        <path d="M24 13v22M13 24h22" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="dashboard-icon" viewBox="0 0 48 48">
      <path d="M20 5H9a4 4 0 0 0-4 4v30a4 4 0 0 0 4 4h11" />
      <path d="M22 24h21m-9-9 9 9-9 9" />
    </svg>
  );
}

function App() {
  const [message, setMessage] = useState("");
  const [screen, setScreen] = useState<"login" | "dashboard">("login");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submitter = event.nativeEvent instanceof SubmitEvent
      ? event.nativeEvent.submitter
      : null;
    const role = submitter instanceof HTMLButtonElement
      ? submitter.value
      : null;

    if (role !== "Professor" && role !== "Student") {
      setMessage("Choose Professor Login or Student Login.");
      return;
    }

    if (role === "Professor") {
      setMessage("");
      setScreen("dashboard");
      return;
    }

    setMessage("Student sign-in is not connected yet.");
  }

  function handleDashboardAction(action: DashboardAction) {
    setMenuOpen(false);

    if (action.id === "logout") {
      setScreen("login");
      setSearch("");
      setMessage("You have left the professor dashboard. Authentication is not connected.");
      return;
    }

    setMessage(`${action.label} is not available yet.`);
  }

  if (screen === "dashboard") {
    const visibleActions = dashboardActions.filter((action) =>
      action.label.toLowerCase().includes(search.trim().toLowerCase()),
    );

    return (
      <main className="dashboard">
        <h1 className="visually-hidden">Professor dashboard</h1>
        <header className="dashboard-header">
          <button
            aria-controls="professor-navigation"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="menu-button"
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <img alt="" height="44" src={menuIcon} width="44" />
          </button>
          <label className="visually-hidden" htmlFor="dashboard-search">
            Search dashboard actions
          </label>
          <input
            autoComplete="off"
            className="dashboard-search"
            id="dashboard-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="SEARCH"
            type="search"
            value={search}
          />
        </header>

        {menuOpen && (
          <nav aria-label="Professor navigation" className="dashboard-menu" id="professor-navigation">
            {dashboardActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleDashboardAction(action)}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </nav>
        )}

        <section aria-label="Professor dashboard shortcuts" className="dashboard-grid">
          {visibleActions.map((action) => (
            <button
              className="dashboard-tile"
              key={action.id}
              onClick={() => handleDashboardAction(action)}
              type="button"
            >
              <ActionIcon icon={action.icon} />
              <span>{action.label}</span>
            </button>
          ))}
          {visibleActions.length === 0 && (
            <p className="dashboard-empty">No dashboard actions match your search.</p>
          )}
        </section>

        <p aria-live="polite" className="dashboard-message">
          {message}
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="login-frame" aria-labelledby="login-title">
        <form className="login-form" onSubmit={handleLogin}>
          <div className="login-panel">
            <h1 id="login-title">LOGIN</h1>
            <div className="fields">
              <label className="visually-hidden" htmlFor="username">
                Username
              </label>
              <input
                autoComplete="username"
                id="username"
                name="username"
                placeholder="USERNAME"
                required
              />
              <label className="visually-hidden" htmlFor="password">
                Password
              </label>
              <input
                autoComplete="current-password"
                id="password"
                name="password"
                placeholder="PASSWORD"
                required
                type="password"
              />
            </div>
          </div>

          <div className="actions" aria-label="Sign in options">
            <button className="action-button" name="role" type="submit" value="Professor">
              Professor Login
            </button>
            <button className="action-button" name="role" type="submit" value="Student">
              Student Login
            </button>
          </div>

          <button
            className="action-button signup-button"
            onClick={() => setMessage("Sign-up is not connected yet.")}
            type="button"
          >
            Sign Up
          </button>

          <p aria-live="polite" className="status-message">
            {message}
          </p>
        </form>
      </section>
    </main>
  );
}

export default App;
