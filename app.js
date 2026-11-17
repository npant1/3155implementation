// Standalone messaging entry point. Host portals can link directly to #/messages.
const app = document.querySelector('#app');
function renderRoute() {
  if (location.hash !== '#/messages') {
    location.replace('#/messages');
    return;
  }
  void renderMessaging();
}
window.addEventListener('hashchange', renderRoute);
renderRoute();
