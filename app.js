const menuButton = document.querySelector(".menu-button");
const closeButton = document.querySelector(".menu-close");
const menu = document.querySelector("#explore-menu");
const backdrop = document.querySelector(".menu-backdrop");

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
  if (event.target.closest("a")) {
    setMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !menu.hidden) {
    setMenuOpen(false);
  }
});
