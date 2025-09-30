const topTrack = document.querySelector(".partners-track.top");
const bottomTrack = document.querySelector(".partners-track.bottom");

if (topTrack && bottomTrack) {
    // Дублируем элементы для верхнего трека (налево)
    const topItems = Array.from(topTrack.children);
    topItems.forEach(item => topTrack.appendChild(item.cloneNode(true)));

    // Дублируем элементы для нижнего трека (направо)
    const bottomItems = Array.from(bottomTrack.children);
    bottomItems.forEach(item => bottomTrack.appendChild(item.cloneNode(true)));

    let speed = 1; // Уменьшил для плавности, можно вернуть 10
    let topPosition = 0;
    let bottomPosition = 0;

    function animatePartners() {
        // Верхний трек движется налево
        topPosition -= speed;
        if (Math.abs(topPosition) >= topTrack.scrollWidth / 2) {
            topPosition = 0;
        }
        topTrack.style.transform = translateX(${topPosition}px);

        // Нижний трек движется направо
        bottomPosition += speed;
        if (bottomPosition >= 0) {
            bottomPosition = -bottomTrack.scrollWidth / 2;
        }
        bottomTrack.style.transform = translateX(${bottomPosition}px);

        requestAnimationFrame(animatePartners);
    }

    animatePartners();
}

function toggleMenu() {
    document.body.classList.toggle("menu-open");
}

// Прокрутка к секции "why-us"
document.getElementById("scrollToWhyUs").addEventListener("click", function() {
    const section = document.querySelector(".why-us");
    if (section) {
        section.scrollIntoView({ behavior: "smooth" });
    }
});