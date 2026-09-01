const bg = document.getElementById("float-bg");

function spawnNumber() {
  const num = document.createElement("div");
  num.className = "float-num";
  num.textContent = Math.floor(Math.random() * 9) + 1;

  num.style.left = Math.random() * 100 + "vw";
  num.style.bottom = "-40px";

  const duration = 6 + Math.random() * 10;
  num.style.animationDuration = duration + "s";

  bg.appendChild(num);

  setTimeout(() => num.remove(), duration * 1000);
}

setInterval(spawnNumber, 400);
