const menuButton = document.querySelector(".menu-button");
const closeButton = document.querySelector(".menu-close");
const menu = document.querySelector("#explore-menu");
const backdrop = document.querySelector(".menu-backdrop");
const homeScreen = document.querySelector("#home-screen");
const listingsScreen = document.querySelector("#listings-screen");
const searchInput = document.querySelector("#listing-search");
const areaFilter = document.querySelector("#area-filter");
const resultsStatus = document.querySelector("#results-status");
const noResults = document.querySelector("#no-results");
const listingCards = [...document.querySelectorAll(".listing-card")];
const researchListingsButton = document.querySelector("#research-listings");
const openProfileButton = document.querySelector("#open-profile");
const backHomeButton = document.querySelector("#back-home");
const opportunityScreen = document.querySelector("#opportunity-screen");
const backListingsButton = document.querySelector("#back-listings");
const professorProfileButton = document.querySelector("#professor-profile");
const professorContact = document.querySelector("#contact-heading");
const applyButton = document.querySelector("#apply-button");
const applicationStatus = document.querySelector("#application-status");
const applicationStorageKey = "campusResearch:application:opportunity-1";
const profileScreen = document.querySelector("#profile-screen");
const profileHeading = document.querySelector("#profile-heading");
const profileStatus = document.querySelector("#profile-status");
const profileEditButton = document.querySelector("#edit-profile");
const profileEditForm = document.querySelector("#profile-edit-form");
const profilePhotoInput = document.querySelector("#profile-photo-input");
const profilePhoto = document.querySelector("#profile-photo");
const profilePhotoPlaceholder = document.querySelector("#profile-photo-placeholder");
const resumeInput = document.querySelector("#resume-input");
const resumeStatus = document.querySelector("#resume-status");
const resumeFile = document.querySelector("#resume-file");
const resumeFilename = document.querySelector("#resume-filename");
const appliedList = document.querySelector("#applied-list");
const emptyApplications = document.querySelector("#empty-applications");
const profileStorageKey = "campusResearch:student-profile";
const resumeMetadataKey = "campusResearch:resume";
const profileDatabaseName = "campusResearchProfile";
const profileAssetStore = "assets";
const profilePhotoKey = "student-photo";
const resumeFileKey = "student-resume";
const defaultProfile = {
  name: "Emily Evans",
  major: "Computer Science",
  concentration: "Cybersecurity",
  year: "Senior",
  about: "I am a very interesting student who loves learning about research. I really want this research opportunity. It would help me a lot."
};
let studentProfile = { ...defaultProfile };
let profilePhotoUrl;
let resumeMetadata;

function renderRoute() {
  const route = window.location.hash.slice(1);
  const showOpportunity = route === "opportunity-1";
  const showProfile = route === "profile";
  const showListings = route === "research-listings" || showOpportunity;

  homeScreen.hidden = showListings || showProfile;
  listingsScreen.hidden = !showListings || showOpportunity;
  opportunityScreen.hidden = !showOpportunity;
  profileScreen.hidden = !showProfile;
  document.querySelector(".student-app").classList.toggle("opportunity-view", showOpportunity);
  document.querySelector(".student-app").classList.toggle("profile-view", showProfile);

  if (showOpportunity) {
    document.title = "Opportunity 1 | Campus Research";
  } else if (showListings) {
    document.title = "Research Listings | Campus Research";
    updateListings();
  } else if (showProfile) {
    document.title = "Student Profile | Campus Research";
    renderStudentProfile();
    renderAppliedListings();
  } else {
    document.title = "Student Home | Campus Research";
  }
}

function navigateTo(route) {
  const nextHash = `#${route}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = route;
  }
  renderRoute();
}

function openListings() {
  navigateTo("research-listings");
  searchInput.focus();
}

function openHome() {
  searchInput.value = "";
  areaFilter.value = "";
  navigateTo("home");
  researchListingsButton.focus();
}

function updateApplicationState() {
  const hasApplied = localStorage.getItem(applicationStorageKey) !== null;
  applyButton.disabled = hasApplied;
  applyButton.textContent = hasApplied ? "Application Submitted" : "Apply";
  applicationStatus.textContent = hasApplied
    ? "Your application has been saved in this browser."
    : "";
}

function updateListings() {
  if (listingsScreen.hidden) {
    return;
  }

  const searchTerms = searchInput.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const selectedArea = areaFilter.value;
  let visibleCount = 0;

  for (const card of listingCards) {
    const areas = card.dataset.area.split(", ");
    const searchableText = `${card.dataset.search} ${card.dataset.area}`.toLocaleLowerCase();
    const matchesSearch = searchTerms.every((term) => searchableText.includes(term));
    const matchesArea = !selectedArea || areas.includes(selectedArea);
    const isVisible = matchesSearch && matchesArea;

    card.hidden = !isVisible;
    visibleCount += Number(isVisible);
  }

  noResults.hidden = visibleCount > 0;
  resultsStatus.textContent = visibleCount === 1
    ? "1 research listing"
    : `${visibleCount} research listings`;
}

function loadStudentProfile() {
  try {
    const storedProfile = localStorage.getItem(profileStorageKey);
    if (storedProfile) {
      const parsedProfile = JSON.parse(storedProfile);
      if (!parsedProfile || typeof parsedProfile !== "object" || Array.isArray(parsedProfile)) {
        throw new Error("Saved profile data is not valid.");
      }

      studentProfile = {
        ...defaultProfile,
        ...Object.fromEntries(
          Object.entries(parsedProfile).filter(([, value]) => typeof value === "string")
        )
      };
    }

    const storedResume = localStorage.getItem(resumeMetadataKey);
    resumeMetadata = storedResume ? JSON.parse(storedResume) : null;
  } catch (error) {
    profileStatus.textContent = `Unable to load saved profile data: ${error.message}`;
  }
}

function renderStudentProfile() {
  profileHeading.textContent = studentProfile.name;
  profilePhoto.alt = `${studentProfile.name}'s profile picture`;
  document.querySelector("#profile-major").textContent = studentProfile.major;
  document.querySelector("#profile-concentration").textContent = studentProfile.concentration || "Not specified";
  document.querySelector("#profile-year").textContent = studentProfile.year;
  document.querySelector("#profile-about").textContent = studentProfile.about || "Add a short introduction about yourself.";
  profilePhotoPlaceholder.textContent = studentProfile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase())
    .join("");

  profileEditForm.elements.name.value = studentProfile.name;
  profileEditForm.elements.major.value = studentProfile.major;
  profileEditForm.elements.concentration.value = studentProfile.concentration;
  profileEditForm.elements.year.value = studentProfile.year;
  profileEditForm.elements.about.value = studentProfile.about;
  renderResumeMetadata();
}

function setProfileEditMode(isEditing) {
  profileEditForm.hidden = !isEditing;
  profileEditButton.setAttribute("aria-expanded", String(isEditing));
  profileEditButton.textContent = isEditing ? "Close Editor" : "Edit Profile";

  if (isEditing) {
    profileEditForm.elements.name.focus();
  }
}

function openProfileDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("This browser does not support local file storage."));
      return;
    }

    const request = window.indexedDB.open(profileDatabaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(profileAssetStore)) {
        request.result.createObjectStore(profileAssetStore);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open local file storage."));
    request.onblocked = () => reject(new Error("Local file storage is blocked by another open tab."));
  });
}

async function saveProfileAsset(key, file) {
  const database = await openProfileDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(profileAssetStore, "readwrite");
    transaction.objectStore(profileAssetStore).put(file, key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Unable to save the selected file."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Saving the selected file was cancelled."));
    };
  });
}

async function readProfileAsset(key) {
  const database = await openProfileDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(profileAssetStore, "readonly");
    const request = transaction.objectStore(profileAssetStore).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Unable to read the saved file."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Unable to read the saved file."));
    };
  });
}

async function deleteProfileAsset(key) {
  const database = await openProfileDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(profileAssetStore, "readwrite");
    transaction.objectStore(profileAssetStore).delete(key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Unable to remove the saved file."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Removing the saved file was cancelled."));
    };
  });
}

function showProfilePhoto(file) {
  if (profilePhotoUrl) {
    URL.revokeObjectURL(profilePhotoUrl);
  }

  profilePhotoUrl = URL.createObjectURL(file);
  profilePhoto.src = profilePhotoUrl;
  profilePhoto.hidden = false;
  profilePhotoPlaceholder.hidden = true;
  profilePhoto.alt = `${studentProfile.name}'s profile picture`;
}

async function loadProfilePhoto() {
  try {
    const photo = await readProfileAsset(profilePhotoKey);
    if (photo) {
      showProfilePhoto(photo);
    }
  } catch (error) {
    profileStatus.textContent = `Unable to load the saved profile picture: ${error.message}`;
  }
}

function renderResumeMetadata() {
  const hasResume = Boolean(resumeMetadata && typeof resumeMetadata.name === "string");
  resumeFile.hidden = !hasResume;
  resumeFilename.textContent = hasResume ? resumeMetadata.name : "";
}

function renderAppliedListings() {
  appliedList.replaceChildren();
  let applicationCount = 0;
  const opportunities = [
    { id: "opportunity-1", title: "Opportunity 1", organization: "Computer Science Dept." },
    { id: "opportunity-2", title: "Opportunity 2: Computer Vision for Robotics", organization: "Research Lab" },
    { id: "opportunity-3", title: "Opportunity 3: Multi-modal AI", organization: "Tech Corp" },
    { id: "opportunity-4", title: "Opportunity 4: Making AI Models Smaller and Faster", organization: "StartUp Inc." },
    { id: "opportunity-5", title: "Opportunity 5: Autonomous AI Agents", organization: "Research Lab" },
    { id: "opportunity-6", title: "Opportunity 6: Campus Dining Optimization", organization: "UNC Charlotte" },
    { id: "opportunity-7", title: "Opportunity 7: Campus Parking Optimization", organization: "UNC Charlotte" }
  ];

  for (const opportunity of opportunities) {
    const rawApplication = localStorage.getItem(`campusResearch:application:${opportunity.id}`);
    if (!rawApplication) {
      continue;
    }

    applicationCount += 1;
    let appliedDate = "Applied";
    if (rawApplication !== "true") {
      try {
        const application = JSON.parse(rawApplication);
        if (application.appliedAt) {
          appliedDate = new Date(application.appliedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "2-digit"
          });
        }
      } catch (error) {
        profileStatus.textContent = `Unable to read an application date: ${error.message}`;
      }
    }

    const item = document.createElement("li");
    item.className = "applied-card";

    const link = document.createElement("a");
    link.className = "applied-card-link";
    link.href = opportunity.id === "opportunity-1" ? "#opportunity-1" : "#research-listings";
    link.setAttribute("aria-label", `View ${opportunity.title}`);

    const icon = document.createElement("span");
    icon.className = "applied-card-icon";
    const iconImage = document.createElement("img");
    iconImage.src = "assets/figma-briefcase.svg";
    iconImage.alt = "";
    icon.append(iconImage);

    const details = document.createElement("span");
    details.className = "applied-card-details";
    const title = document.createElement("span");
    title.className = "applied-card-title";
    title.textContent = opportunity.title;
    const organization = document.createElement("span");
    organization.className = "applied-card-organization";
    organization.textContent = opportunity.organization;
    details.append(title, organization);

    const date = document.createElement("span");
    date.className = "applied-card-date";
    date.textContent = appliedDate;

    link.append(icon, details, date);
    item.append(link);
    appliedList.append(item);
  }

  emptyApplications.hidden = applicationCount > 0;
  appliedList.hidden = applicationCount === 0;
}

for (const area of new Set(listingCards.flatMap((card) => card.dataset.area.split(", ")))) {
  const option = document.createElement("option");
  option.value = area;
  option.textContent = area;
  areaFilter.append(option);
}

function setMenuOpen(isOpen) {
  menu.hidden = !isOpen;
  backdrop.hidden = !isOpen;
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");

  if (isOpen) {
    closeButton.focus();
  } else {
    menuButton.focus();
  }
}

menuButton.addEventListener("click", () => {
  setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
});

closeButton.addEventListener("click", () => setMenuOpen(false));
backdrop.addEventListener("click", () => setMenuOpen(false));

menu.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (link) {
    event.preventDefault();
    setMenuOpen(false);

    if (link.hash === "#research-listings") {
      openListings();
    } else if (link.hash === "#home") {
      openHome();
    } else if (link.hash === "#profile") {
      navigateTo("profile");
    }
  }
});

researchListingsButton.addEventListener("click", openListings);
openProfileButton.addEventListener("click", () => navigateTo("profile"));
backHomeButton.addEventListener("click", openHome);
backListingsButton.addEventListener("click", () => navigateTo("research-listings"));
document.querySelector("#back-profile").addEventListener("click", openHome);
profileEditButton.addEventListener("click", () => {
  setProfileEditMode(profileEditForm.hidden);
});
document.querySelector("#cancel-profile-edit").addEventListener("click", () => {
  renderStudentProfile();
  setProfileEditMode(false);
});
profileEditForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(profileEditForm);
  const updatedProfile = Object.fromEntries(formData.entries());

  try {
    localStorage.setItem(profileStorageKey, JSON.stringify(updatedProfile));
    studentProfile = updatedProfile;
    renderStudentProfile();
    setProfileEditMode(false);
    profileStatus.textContent = "Your profile changes have been saved.";
  } catch (error) {
    profileStatus.textContent = `Unable to save profile changes: ${error.message}`;
  }
});
profilePhotoInput.addEventListener("change", async () => {
  const [file] = profilePhotoInput.files;
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    profileStatus.textContent = "Choose an image file for your profile picture.";
    profilePhotoInput.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    profileStatus.textContent = "The profile picture must be smaller than 5 MB.";
    profilePhotoInput.value = "";
    return;
  }

  try {
    await saveProfileAsset(profilePhotoKey, file);
    showProfilePhoto(file);
    profileStatus.textContent = "Your profile picture has been updated.";
  } catch (error) {
    profileStatus.textContent = `Unable to save your profile picture: ${error.message}`;
  }
});
resumeInput.addEventListener("change", async () => {
  const [file] = resumeInput.files;
  if (!file) {
    return;
  }
  if (!/\.(pdf|docx?)$/i.test(file.name)) {
    resumeStatus.textContent = "Choose a PDF, DOC, or DOCX resume.";
    resumeInput.value = "";
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    resumeStatus.textContent = "The resume must be smaller than 10 MB.";
    resumeInput.value = "";
    return;
  }

  try {
    await saveProfileAsset(resumeFileKey, file);
    resumeMetadata = { name: file.name, type: file.type };
    localStorage.setItem(resumeMetadataKey, JSON.stringify(resumeMetadata));
    renderResumeMetadata();
    resumeStatus.textContent = "Your resume has been saved in this browser.";
  } catch (error) {
    resumeStatus.textContent = `Unable to save your resume: ${error.message}`;
  }
});
document.querySelector("#download-resume").addEventListener("click", async () => {
  try {
    const file = await readProfileAsset(resumeFileKey);
    if (!file) {
      throw new Error("The saved resume could not be found.");
    }
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = resumeMetadata.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  } catch (error) {
    resumeStatus.textContent = `Unable to download your resume: ${error.message}`;
  }
});
document.querySelector("#remove-resume").addEventListener("click", async () => {
  try {
    await deleteProfileAsset(resumeFileKey);
    localStorage.removeItem(resumeMetadataKey);
    resumeMetadata = null;
    resumeInput.value = "";
    renderResumeMetadata();
    resumeStatus.textContent = "Your resume has been removed.";
  } catch (error) {
    resumeStatus.textContent = `Unable to remove your resume: ${error.message}`;
  }
});
professorProfileButton.addEventListener("click", () => {
  professorContact.scrollIntoView({ behavior: "smooth", block: "center" });
  professorContact.focus({ preventScroll: true });
});
applyButton.addEventListener("click", () => {
  localStorage.setItem(applicationStorageKey, JSON.stringify({ appliedAt: new Date().toISOString() }));
  updateApplicationState();
});
searchInput.addEventListener("input", () => {
  if (listingsScreen.hidden) {
    openListings();
    return;
  }

  updateListings();
});
areaFilter.addEventListener("change", updateListings);
window.addEventListener("hashchange", renderRoute);
loadStudentProfile();
renderStudentProfile();
loadProfilePhoto();
updateApplicationState();
renderRoute();

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !menu.hidden) {
    setMenuOpen(false);
  }
});
