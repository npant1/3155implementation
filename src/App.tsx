import { useMemo, useState } from "react";

type Role = "student" | "professor";
type Screen =
  | "login"
  | "signup"
  | "student-home"
  | "professor-home"
  | "listings"
  | "opportunity"
  | "profile"
  | "applicants"
  | "messages"
  | "posts"
  | "post-form"
  | "post-success"
  | "application";

type Opportunity = {
  id: number;
  title: string;
  description: string;
  summary: string;
  field: string;
  professor: string;
  hours: string;
};

const opportunities: Opportunity[] = [
  {
    id: 1,
    title: "Opportunity 1",
    description:
      "This opportunity provides rich experiences for the field of academia. In this opportunity, you will be researching about academia research and will be the best researcher possible. We at this opportunity love research and empower students with research and academia.",
    summary: "This opportunity provides rich experience for the field of academia.",
    field: "Computer Science Dept.",
    professor: "Real Teacher",
    hours: "8–10 hours",
  },
  {
    id: 2,
    title: "Computer Vision for Robotics",
    description:
      "How can we make AI models interpret human reality to then infer and form conclusions?",
    summary: "How can we make AI models interpret human reality to then infer and form conclusions?",
    field: "Robotics Lab",
    professor: "Professor Mejias",
    hours: "6–8 hours",
  },
  {
    id: 3,
    title: "Multi-modal AI (Vision + Language)",
    description:
      "How can we make a vision model more accurate with additional context?",
    summary: "How can we make a vision model more accurate with additional context?",
    field: "Artificial Intelligence",
    professor: "Dr. Hall",
    hours: "8 hours",
  },
  {
    id: 4,
    title: "Making AI Models Smaller and Faster",
    description:
      "How can we optimize AI models for lowest compute and fastest output?",
    summary: "How can we optimize AI models for lowest compute and fastest output?",
    field: "Machine Learning",
    professor: "Professor Mejias",
    hours: "10 hours",
  },
  {
    id: 5,
    title: "Autonomous AI Agents",
    description:
      "How reliable can autonomous AI agents be in completing tasks without user approval?",
    summary: "How reliable can autonomous AI agents be in completing tasks without user approval?",
    field: "Artificial Intelligence",
    professor: "Dr. Hall",
    hours: "5–8 hours",
  },
  {
    id: 6,
    title: "AI-Powered Campus Dining Optimization",
    description:
      "Research how AI can predict dining demand, reduce wait times, and improve food availability.",
    summary: "Research how AI can predict dining demand, reduce wait times, and improve food availability.",
    field: "Data Science",
    professor: "Real Teacher",
    hours: "6 hours",
  },
  {
    id: 7,
    title: "Campus Parking Prediction",
    description:
      "Research how machine learning can predict parking availability and reduce campus congestion.",
    summary: "Research how machine learning can predict parking availability and reduce campus congestion.",
    field: "Machine Learning",
    professor: "Professor Mejias",
    hours: "8 hours",
  },
];

const applicants = [
  { name: "Emily Evans", detail: "Computer Science · Senior" },
  { name: "College C. Student", detail: "Biology · Junior" },
  { name: "College Student Smith", detail: "Data Science · Sophomore" },
  { name: "Carlos Cernan", detail: "Computer Science · Senior" },
];

const initialMessages = [
  { sender: "Carlos Cernan", body: "Hey I saw you posted an undergraduate research opportunity", own: false },
  { sender: "Professor", body: "Hello, Yes are you interested?", own: true },
  { sender: "Carlos Cernan", body: "Yes I am interested", own: false },
  { sender: "Professor", body: "What Year are you in School and what is your major?", own: true },
  { sender: "Carlos Cernan", body: "I am a senior and my major is computer science", own: false },
  { sender: "Professor", body: "Seems like you could be a good fit, please submit an application and I will get back to you soon", own: true },
];

function Icon({ name, size = 42 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (name === "search") {
    return <svg {...common}><circle cx="21" cy="21" r="13" /><path d="m31 31 10 10" /></svg>;
  }
  if (name === "message") {
    return <svg {...common}><path d="M8 11a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H20L9 42V11Z" /></svg>;
  }
  if (name === "plus") {
    return <svg {...common}><circle cx="24" cy="24" r="19" /><path d="M24 14v20M14 24h20" /></svg>;
  }
  if (name === "file") {
    return <svg {...common}><path d="M13 5h16l9 9v29H13a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" /><path d="M28 5v11h10M17 25h13M17 32h13" /></svg>;
  }
  if (name === "logout") {
    return <svg {...common}><path d="M25 8h12a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H25" /><path d="M5 24h25M21 15l9 9-9 9" /></svg>;
  }
  if (name === "upload") {
    return <svg {...common}><path d="M24 31V6m0 0L12 18M24 6l12 12M8 31v8a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-8" /></svg>;
  }
  if (name === "briefcase") {
    return <svg {...common}><rect x="7" y="13" width="34" height="27" rx="3" /><path d="M17 13V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M7 23h34M22 23v5h4v-5" /></svg>;
  }
  return <svg {...common}><circle cx="24" cy="15" r="8" /><path d="M8 42v-4a12 12 0 0 1 12-12h8a12 12 0 0 1 12 12v4" /></svg>;
}

function AppHeader({
  query,
  onQueryChange,
  onSearchSubmit,
  onMenu,
  showSearch = true,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  onMenu: () => void;
  showSearch?: boolean;
}) {
  return (
    <header className="app-header">
      <button className="menu-button" aria-label="Open navigation menu" onClick={onMenu}>
        <img src="/assets/menu.svg" alt="" width="44" height="44" />
      </button>
      {showSearch && (
        <label className="search-box">
          <span className="visually-hidden">Search research opportunities</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") onSearchSubmit(); }}
            placeholder="SEARCH"
          />
        </label>
      )}
    </header>
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [role, setRole] = useState<Role>("student");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState("Featured");
  const [sortOpen, setSortOpen] = useState(false);
  const [selected, setSelected] = useState<Opportunity>(opportunities[0]);
  const [listingReturnTo, setListingReturnTo] = useState<Screen>("student-home");
  const [profileTarget, setProfileTarget] = useState<{ name: string; kind: Role } | null>(null);
  const [profileReturnTo, setProfileReturnTo] = useState<Screen>("student-home");
  const [messages, setMessages] = useState(initialMessages);
  const [messageDraft, setMessageDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [signupError, setSignupError] = useState("");
  const [postStatus, setPostStatus] = useState<"Draft" | "Live">("Draft");
  const [postTitle, setPostTitle] = useState("Computer Vision for Robotics");
  const [postDescription, setPostDescription] = useState(
    "How can we make AI interpret human reality to then infer and form conclusions? Join our lab to explore computer vision for robotics.",
  );
  const [postField, setPostField] = useState("Computer Vision");
  const [postHours, setPostHours] = useState("8–10 hours");
  const [postDuration, setPostDuration] = useState("Winter 2026–Spring 2027");
  const [postDeadline, setPostDeadline] = useState("2026-11-30");
  const [publishedPost, setPublishedPost] = useState<Opportunity | null>(null);

  const visibleOpportunities = useMemo(() => {
    const allOpportunities = publishedPost ? [...opportunities, publishedPost] : opportunities;
    const filtered = allOpportunities.filter((opportunity) =>
      `${opportunity.title} ${opportunity.description} ${opportunity.field}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
    if (sortBy === "A–Z") return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "Newest") return [...filtered].reverse();
    return filtered;
  }, [publishedPost, query, sortBy]);

  const navigate = (next: Screen) => {
    setScreen(next);
    if (next !== "profile") setProfileTarget(null);
    setMenuOpen(false);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const signIn = (nextRole: Role) => {
    setRole(nextRole);
    navigate(nextRole === "student" ? "student-home" : "professor-home");
  };

  const openOpportunity = (opportunity: Opportunity) => {
    setSelected(opportunity);
    navigate("opportunity");
  };

  const openListings = (returnTo: Screen = role === "student" ? "student-home" : "professor-home") => {
    setListingReturnTo(returnTo);
    navigate("listings");
  };

  const openProfile = (target: { name: string; kind: Role } | null = null, returnTo: Screen = role === "student" ? "student-home" : "professor-home") => {
    setProfileTarget(target);
    setProfileReturnTo(returnTo);
    navigate("profile");
  };

  const publishPost = () => {
    if (!postTitle.trim() || !postDescription.trim()) {
      setNotice("Add a title and description before publishing.");
      return;
    }
    const listing = {
      id: 8,
      title: postTitle.trim(),
      description: postDescription.trim(),
      summary: postDescription.trim().length > 105 ? `${postDescription.trim().slice(0, 102)}…` : postDescription.trim(),
      field: postField.trim() || "Research",
      professor: "Professor Mejias",
      hours: postHours.trim() || "8 hours",
    };
    setPublishedPost(listing);
    setSelected(listing);
    setPostStatus("Live");
    navigate("post-success");
  };

  const sendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = messageDraft.trim();
    if (!body) {
      setNotice("Write a message before sending.");
      return;
    }
    setMessages((current) => [...current, { sender: "You", body, own: false }]);
    setMessageDraft("");
    setNotice("");
  };

  const createStudentAccount = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");
    if (password !== confirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }
    setSignupError("");
    signIn("student");
  };

  const renderHeader = (showSearch = true) => (
    <AppHeader
      query={query}
      onQueryChange={setQuery}
      onSearchSubmit={() => openListings()}
      onMenu={() => setMenuOpen(true)}
      showSearch={showSearch}
    />
  );

  const renderBack = (label = "Back", destination: Screen = role === "student" ? "student-home" : "professor-home") => (
    <button className="back-button" onClick={() => navigate(destination)}>{label}</button>
  );

  return (
    <main className="app-shell">
      {screen === "login" && (
        <section className="login-screen">
          <div className="login-panel">
            <h1>LOGIN</h1>
            <label className="login-input">
              <span className="visually-hidden">Username</span>
              <input placeholder="USERNAME" autoComplete="username" />
            </label>
            <label className="login-input">
              <span className="visually-hidden">Password</span>
              <input placeholder="PASSWORD" type="password" autoComplete="current-password" />
            </label>
          </div>
          <div className="login-actions">
            <button onClick={() => signIn("professor")}>Professor Login</button>
            <button onClick={() => signIn("student")}>Student Login</button>
            <button className="signup-link" onClick={() => navigate("signup")}>Sign Up</button>
          </div>
        </section>
      )}

      {screen === "signup" && (
        <section className="signup-screen">
          <div className="signup-header">
            <button className="signup-back" onClick={() => navigate("login")}>Back</button>
            <h1>Sign Up</h1>
            <p>Create a reusable research profile with academic details, skill tags, availability, and hosted documents.</p>
          </div>
          <form className="signup-form" onSubmit={createStudentAccount}>
            <FormSection title="Account">
              <Field label="Email" placeholder="you@charlotte.edu" type="email" name="email" required />
              <Field label="Username" placeholder="researcher_alex" name="username" required />
              <Field label="Password" placeholder="Create a strong password" type="password" name="password" required />
              <Field label="Confirm Password" placeholder="Re-enter password" type="password" name="confirmPassword" required />
            </FormSection>
            <FormSection title="Academic profile">
              <Field label="Major" placeholder="e.g. Neuroscience, Computer Science" />
              <Field label="Year" placeholder="e.g. Sophomore, Junior" />
              <Field label="Concentration" placeholder="e.g. Cybersecurity" />
              <Field label="About me" placeholder="Tell faculty about your interests and goals" multiline />
            </FormSection>
            <FormSection title="Technical skills">
              <div className="chips">{["Python", "MATLAB", "R", "SQL", "Wet lab", "Statistical analysis", "Machine learning", "Data visualization"].map((item) => <span className="chip" key={item}>{item}</span>)}</div>
            </FormSection>
            <FormSection title="Availability">
              <Field label="Hours per week" placeholder="8–10 hours" />
              <div className="chips">{["Fall", "Spring", "Summer"].map((item) => <span className="chip" key={item}>{item}</span>)}</div>
            </FormSection>
            <FormSection title="Document hosting">
              <Field label="Resume / CV" placeholder="Upload or link your latest CV" />
              <Field label="Transcript" placeholder="Upload unofficial or official transcript" />
              <Field label="Cover letter templates" placeholder="Add reusable cover letter drafts" />
              <Field label="Work samples" placeholder="Upload coursework, code repos, or project files" />
            </FormSection>
            {signupError && <p className="inline-notice" role="alert">{signupError}</p>}
            <button className="primary-button" type="submit">Create account</button>
          </form>
        </section>
      )}

      {(screen === "student-home" || screen === "professor-home") && (
        <>
          {renderHeader()}
          <section className="dashboard-screen">
            {screen === "student-home" ? (
              <div className="dashboard-grid">
                <DashboardTile icon="user" label="Profile" onClick={() => openProfile()} />
                <DashboardTile icon="search" label="Research Listings" onClick={() => openListings("student-home")} />
                <DashboardTile icon="message" label="Messaging" onClick={() => navigate("messages")} />
                <DashboardTile icon="logout" label="Log Out" onClick={() => navigate("login")} />
              </div>
            ) : (
              <div className="dashboard-grid">
                <DashboardTile icon="user" label="Profile" onClick={() => openProfile()} />
                <DashboardTile icon="search" label="View Applicants" onClick={() => navigate("applicants")} />
                <DashboardTile icon="plus" label="Posts" onClick={() => navigate("posts")} />
                <DashboardTile icon="logout" label="Log Out" onClick={() => navigate("login")} />
              </div>
            )}
          </section>
        </>
      )}

      {screen === "listings" && (
        <>
          {renderHeader()}
          <section className="listing-screen">
            <div className="listing-toolbar">
              {renderBack("Back", listingReturnTo)}
              <div className="sort-wrap">
                <button className="sort-button" onClick={() => setSortOpen((value) => !value)}>
                  Sort <span aria-hidden="true">{sortOpen ? "⌃" : "⌄"}</span>
                </button>
                {sortOpen && (
                  <div className="sort-menu" role="menu">
                    {["Featured", "Newest", "A–Z"].map((option) => (
                      <button key={option} role="menuitem" onClick={() => { setSortBy(option); setSortOpen(false); }}>
                        {option}{sortBy === option && <span aria-label="selected">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="opportunity-list">
              {visibleOpportunities.map((opportunity) => (
                <button className="opportunity-card" key={opportunity.id} onClick={() => openOpportunity(opportunity)}>
                  <strong>{opportunity.id > 1 ? `Opportunity ${opportunity.id}: ` : ""}{opportunity.title}</strong>
                  <span>Description: {opportunity.summary}</span>
                </button>
              ))}
              {visibleOpportunities.length === 0 && <p className="empty-state">No research opportunities match “{query}”.</p>}
            </div>
          </section>
        </>
      )}

      {screen === "opportunity" && (
        <>
          {renderHeader(false)}
          <section className="opportunity-detail">
            {renderBack("Back", "listings")}
            <h1>{selected.title}</h1>
            <div className="detail-panel">
              <h2>Description:</h2>
              <p>{selected.description}</p>
              <h2>Contact Info:</h2>
              <p>{selected.professor}<br />{selected.professor === "Real Teacher" ? "realteacher@charlotte.edu" : "mejias@charlotte.edu"}<br />123-456-7890</p>
              <p className="detail-meta"><strong>Research area</strong><br />{selected.field}</p>
              <p className="detail-meta"><strong>Weekly commitment</strong><br />{selected.hours}</p>
            </div>
            <div className="detail-actions">
              <button onClick={() => openProfile({ name: selected.professor, kind: "professor" }, "opportunity")}>Professor Profile</button>
              {role === "student" && <button onClick={() => navigate("application")}>Apply</button>}
            </div>
            <h2 className="members-title">Members</h2>
            {applicants.map((person) => <button className="member-row" key={person.name} onClick={() => openProfile({ name: person.name, kind: "student" }, "opportunity")}><Icon name="user" size={38} />{person.name}</button>)}
          </section>
        </>
      )}

      {screen === "application" && (
        <>
          {renderHeader(false)}
          <section className="application-screen">
            <h1>{selected.title}</h1>
            <div className="resume-actions">
              <Icon name="upload" size={92} />
              <div>
                <label className="primary-button file-button">Upload Resume<input type="file" accept=".pdf,.doc,.docx" onChange={() => setNotice("Resume selected")} /></label>
                <button className="primary-button" onClick={() => setNotice("Using your saved resume")}>Use Current</button>
              </div>
            </div>
            <label className="comment-field">
              <span>Include a comment:</span>
              <textarea rows={7} placeholder="Share a little about your interest in this opportunity." />
            </label>
            {notice && <p className="inline-notice" role="status">{notice}</p>}
            <div className="application-actions">
              <button onClick={() => navigate("opportunity")}>Cancel</button>
              <button onClick={() => { setNotice("Your application has been submitted."); }}>Apply</button>
            </div>
          </section>
        </>
      )}

      {screen === "profile" && (
        <>
          {renderHeader(false)}
          <section className="profile-screen">
            {renderBack("Back", profileReturnTo)}
            <h1>{profileTarget?.name ?? (role === "student" ? "Emily Evans" : "Professor Mejias")}</h1>
            <div className="profile-intro">
              {profileTarget?.kind === "student" && profileTarget.name !== "Emily Evans" ? (
                <span className="profile-avatar profile-avatar--placeholder"><Icon name="user" size={58} /></span>
              ) : (
                <img
                  className="profile-avatar"
                  src={(profileTarget?.kind ?? role) === "student" ? "/assets/emily-evans.png" : "/assets/professor-mejias.jpeg"}
                  alt={profileTarget?.name ?? (role === "student" ? "Emily Evans" : "Professor Mejias")}
                />
              )}
              <p>{(profileTarget?.kind ?? role) === "student"
                ? <>Major: Computer Science<br />Concentration: Cybersecurity<br />Year: Senior</>
                : <>Research Faculty<br />Computer Science Department<br />UNC Charlotte</>}</p>
            </div>
            <div className="about-block">
              <strong>About Me:</strong>
              <p>{(profileTarget?.kind ?? role) === "student" ? "I am a very interesting student who loves learning about research. I really want this research opportunity. It would help me a lot." : "I lead research teams in computer vision and applied artificial intelligence. I enjoy mentoring students and helping them grow through research."}</p>
            </div>
            {(profileTarget?.kind ?? role) === "student" ? (
              <>
                <label className="upload-profile">
                  <Icon name="upload" size={64} />
                  Upload Resume
                  <input className="visually-hidden" type="file" accept=".pdf,.doc,.docx" onChange={(event) => setNotice(event.target.files?.[0] ? `${event.target.files[0].name} selected` : "")} />
                </label>
                {notice && <p className="inline-notice">{notice}</p>}
                <div className="applied-list">
                  <h2>Applied Listings</h2>
                  {opportunities.slice(0, 3).map((opportunity, index) => (
                    <button className="applied-card" key={opportunity.id} onClick={() => openOpportunity(opportunity)}>
                      <span className="applied-icon"><Icon name="briefcase" size={21} /></span>
                      <span><strong>{opportunity.title}</strong><small>{opportunity.field}</small></span>
                      <time>{["Oct 12", "Oct 08", "Sep 28"][index]}</time>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button className="primary-button profile-message" onClick={() => navigate("messages")}>Message Professor</button>
            )}
          </section>
        </>
      )}

      {screen === "applicants" && (
        <>
          {renderHeader()}
          <section className="applicants-screen">
            <h1>Applicant Information</h1>
            {applicants.map((person, index) => (
              <button className="applicant-card" key={person.name} onClick={() => openProfile({ name: person.name, kind: "student" }, "applicants")}>
              {index === 0 ? <img src="/assets/emily-evans.png" alt="" /> : <span className="applicant-avatar"><Icon name="user" size={36} /></span>}
                <span><strong>{person.name}</strong><small>{person.detail}</small></span>
              </button>
            ))}
            {renderBack()}
          </section>
        </>
      )}

      {screen === "messages" && (
        <section className="messages-screen">
          <header className="messages-header">
            <button className="menu-button" aria-label="Open navigation menu" onClick={() => setMenuOpen(true)}>
              <img src="/assets/menu.svg" alt="" width="44" height="44" />
            </button>
            <img src="/assets/professor-mejias.jpeg" alt="" />
            <h1>Professors Mejias</h1>
            <button className="messages-back" onClick={() => navigate(role === "student" ? "student-home" : "professor-home")}>Back</button>
          </header>
          <div className="conversation">
            {messages.map((message, index) => (
              <div className={`message-group ${message.own ? "message-group--own" : ""}`} key={`${message.sender}-${index}`}>
                <strong>{message.sender}</strong>
                <p>{message.body}</p>
              </div>
            ))}
          </div>
          <form className="message-composer" onSubmit={sendMessage}>
            <label className="visually-hidden" htmlFor="message">Type your message</label>
            <input id="message" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="Type your message..." />
            <button type="submit">Send</button>
            {notice && <p className="message-notice" role="status">{notice}</p>}
          </form>
        </section>
      )}

      {screen === "posts" && (
        <>
          {renderHeader()}
          <section className="posts-screen">
            {renderBack()}
            <div className="posts-grid">
              <DashboardTile icon="file" label="Active Postings" onClick={() => openListings("posts")} />
              <DashboardTile icon="plus" label="New Post" onClick={() => navigate("post-form")} />
            </div>
            {postStatus === "Draft" && <p className="draft-note">You have a saved draft ready to continue.</p>}
          </section>
        </>
      )}

      {screen === "post-form" && (
        <>
          {renderHeader()}
          <section className="post-form-screen">
            {renderBack("Back", "posts")}
            <div className="section-title-row"><div><h1>Post Builder</h1><p>Create a research opportunity for students.</p></div><span className="status-pill">{postStatus}</span></div>
            <form className="post-form" onSubmit={(event) => { event.preventDefault(); publishPost(); }}>
              <Field label="Title *" value={postTitle} onChange={setPostTitle} />
              <Field label="Description *" value={postDescription} onChange={setPostDescription} multiline />
              <Field label="Research area *" value={postField} onChange={setPostField} />
              <Field label="Responsibilities *" placeholder={"• Collect and annotate robotics datasets\n• Implement baseline vision models\n• Test inference on lab hardware"} multiline />
              <Field label="Goals *" placeholder={"• Improve scene understanding for robotic grasping\n• Reduce inference latency on edge hardware\n• Document a reproducible evaluation pipeline"} multiline />
              <Field label="Prerequisites *" placeholder={"• Familiarity with Python\n• Coursework in AI or machine learning\n• Available 8–10 hours per week"} multiline />
              <Field label="Project duration *" value={postDuration} onChange={setPostDuration} />
              <Field label="Hours per week *" value={postHours} onChange={setPostHours} />
              <Field label="Application deadline *" type="date" value={postDeadline} onChange={setPostDeadline} />
              <small>Applications close at 11:59 PM on this date.</small>
              <p className="form-hint">Your published post will appear in Research Listings.</p>
              {notice && <p className="inline-notice" role="status">{notice}</p>}
              <div className="post-actions">
                <button type="button" className="secondary-button" onClick={() => { setPostStatus("Draft"); navigate("posts"); }}>Save draft</button>
                <button className="primary-button" type="submit">Publish post</button>
              </div>
            </form>
          </section>
        </>
      )}

      {screen === "post-success" && (
        <>
          {renderHeader()}
          <section className="post-success-screen">
            <div className="success-heading"><span className="success-check">✓</span><h1>Listing published!</h1><p>Your research opportunity is now visible to students.</p></div>
            <div className="success-card">
              <div className="success-card-top"><strong>Published listing</strong><span>Live</span></div>
              <h2>{postTitle}</h2>
              <p>Research opportunity · {selected.field}</p>
              <p>{postDescription}</p>
              <hr />
              <div className="success-detail"><span>Project duration</span><strong>{postDuration}</strong></div>
              <div className="success-detail"><span>Weekly commitment</span><strong>{postHours}</strong></div>
              <div className="success-detail"><span>Application deadline</span><strong>{new Date(`${postDeadline}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong></div>
            </div>
            <div className="success-actions">
              <button className="primary-button" onClick={() => navigate("opportunity")}>View listing</button>
              <button className="secondary-button" onClick={() => navigate("professor-home")}>Back to dashboard</button>
              <button className="text-button" onClick={() => navigate("posts")}>Manage postings</button>
            </div>
          </section>
        </>
      )}

      {menuOpen && (
        <div className="menu-backdrop" onClick={() => setMenuOpen(false)}>
          <nav className="navigation-drawer" aria-label="Main navigation" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-heading"><strong>Research Connect</strong><button onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button></div>
            {(role === "student"
              ? [["Home", "student-home"], ["Research Listings", "listings"], ["Profile", "profile"], ["Messaging", "messages"]]
              : [["Home", "professor-home"], ["Applicants", "applicants"], ["Posts", "posts"], ["Profile", "profile"], ["Messaging", "messages"]]
            ).map(([label, target]) => (
              <button key={target} onClick={() => target === "listings" ? openListings() : navigate(target as Screen)}>{label}<span aria-hidden="true">›</span></button>
            ))}
            <button onClick={() => navigate("login")}>Log Out<span aria-hidden="true">↗</span></button>
          </nav>
        </div>
      )}
    </main>
  );
}

function DashboardTile({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button className="dashboard-tile" onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="form-section"><legend>{title}</legend>{children}</fieldset>;
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  name,
  required = false,
  type = "text",
  multiline = false,
}: {
  label: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {multiline ? (
        <textarea name={name} required={required} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} rows={3} />
      ) : (
        <input name={name} required={required} type={type} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} />
      )}
    </label>
  );
}

export default App;
