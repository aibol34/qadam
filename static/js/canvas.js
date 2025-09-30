const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d");
let stars = [];
const numStars = 1200;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function initStars() {
  stars = [];
  for (let i = 0; i < numStars; i++) {
    stars.push({
      x: Math.random() * canvas.width - canvas.width / 2,
      y: Math.random() * canvas.height - canvas.height / 2,
      z: Math.random() * canvas.width,
      pz: Math.random() * canvas.width
    });
  }
}

function draw() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.lineWidth = 1;

  for (let star of stars) {
    star.z -= 2;
    if (star.z < 1) {
      star.z = canvas.width;
      star.x = Math.random() * canvas.width - canvas.width / 2;
      star.y = Math.random() * canvas.height - canvas.height / 2;
      star.pz = star.z;
    }

    const sx = cx + (star.x / star.z) * canvas.width;
    const sy = cy + (star.y / star.z) * canvas.width;

    const px = cx + (star.x / star.pz) * canvas.width;
    const py = cy + (star.y / star.pz) * canvas.width;

    star.pz = star.z;

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(sx, sy);
    ctx.strokeStyle = 'white';
    ctx.stroke();
  }

  requestAnimationFrame(draw);
}

initStars();
draw();