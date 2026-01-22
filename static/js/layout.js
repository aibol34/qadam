document.addEventListener("DOMContentLoaded", () => {

  // === Mobile menu ===
  const toggle = document.getElementById("mobileToggle");
  const menu = document.getElementById("mainMenu");

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      menu.classList.toggle("open");
    });
  }

  // === Sticky header ===
  const header = document.querySelector('.dark-header');
  const intro = document.getElementById('intro');

  if (!header) return;

  window.addEventListener("scroll", () => {
    if (intro) {
      if (window.scrollY > intro.offsetHeight - 80) {
        header.classList.add("sticky");
      } else {
        header.classList.remove("sticky");
      }
    } else {
      header.classList.add("sticky");
    }
  });

});
