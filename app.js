let listings = [];
let currentUser = null;
let authMode = "login";

const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const listingsContainer = document.querySelector("#listings");
const resultsCount = document.querySelector("#results-count");
const emptyState = document.querySelector("#empty-state");
const listingsPage = document.querySelector(".listings-page");
const opportunityPage = document.querySelector("#opportunity-page");
const opportunityContent = document.querySelector("#opportunity-content");
const apiError = document.querySelector("#api-error");
const accountDialog = document.querySelector("#account-dialog");
const accountForm = document.querySelector("#account-form");
const accountMessage = document.querySelector("#account-message");
const registrationFields = document.querySelector("#registration-fields");
const accountPassword = document.querySelector("#account-password");

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function apiRequest(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new ApiError(payload?.detail || "The request could not be completed.", response.status);
  }
  return payload;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatDate(date) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function formatHours(hours) {
  return Number(hours).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function commitmentLabel(listing) {
  const minimum = formatHours(listing.weekly_hours_min);
  const maximum = formatHours(listing.weekly_hours_max);
  const range = minimum === maximum ? minimum : `${minimum}–${maximum}`;
  return `${range} hours / week`;
}

function cardMarkup(listing) {
  const opportunityUrl = `#opportunity/${encodeURIComponent(listing.slug)}`;
  return `
    <article class="listing-card">
      <div class="card-topline">
        <span class="department">${escapeHtml(listing.department)}</span>
        <span class="posted-date">Posted ${formatDate(listing.posted)}</span>
      </div>
      <h2>${escapeHtml(listing.title)}</h2>
      <p class="faculty">${escapeHtml(listing.faculty)}</p>
      <p class="description">${escapeHtml(listing.description)}</p>
      <ul class="area-tags" aria-label="Research areas">
        ${listing.areas.map((area) => `<li>${escapeHtml(area)}</li>`).join("")}
      </ul>
      <div class="card-footer">
        <span class="commitment">${commitmentLabel(listing)}</span>
        <span class="deadline">Apply by ${formatDate(listing.deadline)}</span>
      </div>
      <a class="card-link" href="${opportunityUrl}" aria-label="View details for ${escapeHtml(listing.title)}">View opportunity <span aria-hidden="true">→</span></a>
    </article>
  `;
}

function getVisibleListings() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const filtered = listings.filter((listing) => {
    const searchableText = [
      listing.title,
      listing.department,
      listing.faculty,
      listing.description,
      ...listing.areas,
    ].join(" ").toLocaleLowerCase();
    return searchableText.includes(query);
  });

  switch (sortSelect.value) {
    case "title-asc":
      filtered.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "deadline":
      filtered.sort((a, b) => a.deadline.localeCompare(b.deadline));
      break;
    default:
      filtered.sort((a, b) => b.posted.localeCompare(a.posted));
  }

  return filtered;
}

function renderListings() {
  const visibleListings = getVisibleListings();
  const count = visibleListings.length;
  listingsContainer.innerHTML = visibleListings.map(cardMarkup).join("");
  resultsCount.textContent = `${count} ${count === 1 ? "opportunity" : "opportunities"}`;
  emptyState.hidden = count !== 0;
  listingsContainer.hidden = count === 0;
}

function detailListMarkup(title, entries) {
  if (entries.length === 0) return "";
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <ul class="opportunity-bullets">${entries.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>
    </section>
  `;
}

function applicationMarkup() {
  const profile = currentUser?.student_profile;
  const isStudent = currentUser?.role === "student" && profile;
  const prompt = currentUser
    ? "Sign in with a student account to apply to this opportunity."
    : "Sign in or create a student account to submit an application.";

  return `
    <aside class="application-panel" aria-labelledby="apply-title">
      <h2 id="apply-title">Apply to this opportunity</h2>
      <p>Share a few details with the professor to get started.</p>
      <p class="application-auth-prompt" ${isStudent ? "hidden" : ""}>${escapeHtml(prompt)}</p>
      <form class="application-form">
        <label for="applicant-name">Full name</label>
        <input id="applicant-name" name="name" value="${escapeHtml(profile?.full_name || "")}" readonly>

        <label for="applicant-email">Email address</label>
        <input id="applicant-email" name="email" type="email" value="${escapeHtml(currentUser?.email || "")}" readonly>

        <label for="applicant-major">Major or area of study</label>
        <input id="applicant-major" name="major" value="${escapeHtml(profile?.major || "")}" readonly>

        <label for="applicant-interest">Why are you interested?</label>
        <textarea id="applicant-interest" name="interest" rows="4" minlength="10" maxlength="5000" required></textarea>

        <button class="apply-button" type="submit" ${isStudent ? "" : "disabled"}>Submit application</button>
        <p class="application-note">Your profile details are shared with the professor who posted this opportunity.</p>
        <p class="application-status" role="status" aria-live="polite"></p>
      </form>
    </aside>
  `;
}

function opportunityMarkup(listing) {
  const professor = escapeHtml(listing.faculty);
  return `
    <header class="opportunity-heading">
      <p class="eyebrow">${escapeHtml(listing.department)}</p>
      <h1 id="opportunity-title">${escapeHtml(listing.title)}</h1>
      <p class="opportunity-faculty">Posted by <strong>${professor}</strong></p>
    </header>

    <div class="opportunity-layout">
      <article class="opportunity-details">
        <section aria-labelledby="about-title">
          <h2 id="about-title">About this opportunity</h2>
          <p>${escapeHtml(listing.description)}</p>
        </section>
        <section aria-labelledby="research-areas-title">
          <h2 id="research-areas-title">Research areas</h2>
          <ul class="area-tags" aria-label="Research areas">
            ${listing.areas.map((area) => `<li>${escapeHtml(area)}</li>`).join("")}
          </ul>
        </section>
        ${detailListMarkup("Responsibilities", listing.responsibilities)}
        ${detailListMarkup("Project goals", listing.goals)}
        ${detailListMarkup("Prerequisites", listing.prerequisites)}
        <section class="opportunity-facts" aria-label="Opportunity details">
          <div><span>Time commitment</span><strong>${commitmentLabel(listing)}</strong></div>
          <div><span>Duration</span><strong>${escapeHtml(listing.duration)}</strong></div>
          <div><span>Application deadline</span><strong>${formatDate(listing.deadline)}</strong></div>
          <div><span>Posted</span><strong>${formatDate(listing.posted)}</strong></div>
        </section>
      </article>
      ${applicationMarkup()}
    </div>
  `;
}

function renderRoute() {
  const route = window.location.hash;
  const match = route.match(/^#opportunity\/([a-z0-9-]+)$/);
  const listing = match && listings.find((item) => item.slug === match[1]);

  if (!listing) {
    listingsPage.hidden = false;
    opportunityPage.hidden = true;
    document.title = "Research Opportunities | Campus Portal";
    apiError.textContent = match ? "That opportunity could not be found." : "";
    return;
  }

  apiError.textContent = "";
  opportunityContent.innerHTML = opportunityMarkup(listing);
  listingsPage.hidden = true;
  opportunityPage.hidden = false;
  document.title = `${listing.title} | Campus Research`;
}

function updateAuthUi() {
  const isStudent = currentUser?.role === "student" && currentUser.student_profile;
  document.querySelector("#account-indicator").textContent = currentUser
    ? `Signed in as ${currentUser.email}`
    : "Sign in to apply";
  document.querySelector("#open-login").hidden = Boolean(currentUser);
  document.querySelector("#open-register").hidden = Boolean(currentUser);
  document.querySelector("#logout-button").hidden = !currentUser;
  if (!opportunityPage.hidden && listings.length > 0) renderRoute();
  return isStudent;
}

function setAuthMode(mode) {
  authMode = mode;
  const isRegistration = mode === "register";
  registrationFields.hidden = !isRegistration;
  for (const input of registrationFields.querySelectorAll("input")) {
    input.disabled = !isRegistration;
    input.required = isRegistration;
  }
  accountPassword.autocomplete = isRegistration ? "new-password" : "current-password";
  document.querySelector("#account-password-help").hidden = !isRegistration;
  document.querySelector("#account-submit").textContent = isRegistration ? "Create student account" : "Sign in";
  for (const button of document.querySelectorAll("[data-auth-mode]")) {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  }
  accountMessage.textContent = "";
}

searchInput.addEventListener("input", renderListings);
sortSelect.addEventListener("change", renderListings);
window.addEventListener("hashchange", renderRoute);

document.querySelector("#open-login").addEventListener("click", () => {
  setAuthMode("login");
  accountDialog.showModal();
});
document.querySelector("#open-register").addEventListener("click", () => {
  setAuthMode("register");
  accountDialog.showModal();
});
document.querySelector("#close-account-dialog").addEventListener("click", () => accountDialog.close());
document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  accountMessage.textContent = "";
  const formData = new FormData(accountForm);
  const payload = {
    email: formData.get("email"),
    password: formData.get("password"),
  };
  if (authMode === "register") {
    payload.full_name = formData.get("full_name");
    payload.major = formData.get("major");
  }

  try {
    currentUser = await apiRequest(`/api/auth/${authMode === "register" ? "register" : "login"}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    accountForm.reset();
    accountDialog.close();
    apiError.textContent = "";
    updateAuthUi();
  } catch (error) {
    accountMessage.textContent = error.message || "Unable to update your account. Please try again.";
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
    currentUser = null;
    updateAuthUi();
  } catch (error) {
    apiError.textContent = error.message || "Unable to sign out. Please try again.";
  }
});

opportunityContent.addEventListener("submit", async (event) => {
  if (!event.target.matches(".application-form")) return;
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;

  const listing = listings.find((item) => window.location.hash === `#opportunity/${item.slug}`);
  if (!listing) return;

  const status = form.querySelector(".application-status");
  const button = form.querySelector(".apply-button");
  let submitted = false;
  status.textContent = "";
  button.disabled = true;
  try {
    await apiRequest(`/api/opportunities/${listing.id}/applications`, {
      method: "POST",
      body: JSON.stringify({
        interest_statement: form.elements.interest.value.trim(),
      }),
    });
    status.textContent = "Your application was submitted successfully.";
    submitted = true;
    button.textContent = "Application submitted";
  } catch (error) {
    status.textContent = error.message || "Your application could not be submitted. Please try again.";
  } finally {
    button.disabled = submitted || !currentUser || currentUser.role !== "student";
  }
});

async function initialize() {
  let sessionError = "";
  try {
    try {
      currentUser = await apiRequest("/api/auth/session");
    } catch (error) {
      if (error.status === 401) {
        sessionError = error.message;
      } else {
        throw error;
      }
    }
    listings = await apiRequest("/api/opportunities");
    updateAuthUi();
    renderListings();
    renderRoute();
    if (sessionError) apiError.textContent = sessionError;
  } catch (error) {
    apiError.textContent = error.message || "Unable to load research opportunities.";
    listingsContainer.hidden = true;
    resultsCount.textContent = "";
    emptyState.hidden = true;
  }
}

initialize();
