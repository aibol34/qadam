console.log("career.js подключен ✅");

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("career-form");
  const loading = document.getElementById("loading");
  const resultSection = document.getElementById("result-section");
  const aiRecommendations = document.getElementById("ai-recommendations");
  const btnText = document.getElementById("btn-text");
  const analyzeBtn = document.getElementById("analyze-btn");

  // Кэш для графиков
  let hhCache = null;
  let vacancyChart = null;
  let salaryChart = null;

  // === Переключение вкладок (десктоп + моб) ===
  function initializeTabs() {
    const tabs = document.querySelectorAll(".tab, .mobile-item");
    if (!tabs.length) return;

    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        // убираем активные
        document.querySelectorAll(".tab.active").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content.active").forEach(c => c.classList.remove("active"));

        // активируем новый
        const tabName = tab.dataset.tab;
        const desktopTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
        if (desktopTab) desktopTab.classList.add("active");
        document.getElementById(tabName).classList.add("active");

        // если открыли графики
        if (tabName === "charts" && hhCache) {
          setTimeout(() => createCharts(hhCache), 200);
        }
      });
    });
  }

  // === Обработка формы ===
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const skills = document.getElementById("skills").value.trim();
    const interests = document.getElementById("interests").value.trim();
    if (!skills) return showError("Введите хотя бы один навык!");

    setLoading(true);

    try {
      // 1. AI рекомендации
      const aiRes = await fetch("/career/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills, interests })
      });
      const aiData = await aiRes.json();
      if (aiData.error) throw new Error(aiData.error);

      displayAI(aiData.result);

      // 2. Парсим профессии
      const professions = parseProfessions(aiData.result);
      if (!professions.length) throw new Error("AI не вернул профессии");

      // 3. HeadHunter API
      const hhRes = await fetch("/career/relevance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professions: professions.slice(0, 10) })
      });
      const hhData = await hhRes.json();
      if (hhData.error) throw new Error(hhData.error);

      hhCache = hhData;
      renderProfessions(hhData);
      setTimeout(() => createCharts(hhData), 300);

      showResults();

    } catch (err) {
      console.error(err);
      showError("Ошибка: " + err.message);
    } finally {
      setLoading(false);
    }
  });

  // === Вспомогательные функции ===
  function setLoading(isLoading) {
    if (isLoading) {
      loading.style.display = "block";
      resultSection.style.display = "none";
      analyzeBtn.disabled = true;
      btnText.textContent = "АНАЛИЗ...";
    } else {
      loading.style.display = "none";
      analyzeBtn.disabled = false;
      btnText.textContent = "АНАЛИЗИРОВАТЬ ПОТЕНЦИАЛ";
    }
  }

  function showResults() {
    resultSection.style.display = "block";
    resultSection.classList.add("active");
  }

  function showError(msg) {
    aiRecommendations.innerHTML =
      `<div style="color: var(--danger); padding:1rem; border:1px solid var(--danger); border-radius:8px;">⚠ ${msg}</div>`;
    showResults();
  }

  function displayAI(text) {
    const formatted = text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    aiRecommendations.innerHTML = formatted;
  }

  function parseProfessions(text) {
    const regex = /^\d+\.\s*\*\*(.+?)\*\*/gm;
    let match, arr = [];
    while ((match = regex.exec(text)) !== null) arr.push(match[1]);
    return arr;
  }

  // === Карточки профессий ===
  function renderProfessions(data) {
    const container = document.getElementById("profession-cards");
    container.innerHTML = "";
    data.forEach(p => {
      const trendClass = p.trend.includes("↑") ? "up" : p.trend.includes("↓") ? "down" : "neutral";
      const card = document.createElement("div");
      card.className = "profession-card";
      card.innerHTML = `
        <div class="profession-title">
          <span>${p.profession}</span>
          <span class="salary">${p.average_salary ? p.average_salary.toLocaleString()+" ₸" : "Н/Д"}</span>
        </div>
        <div class="stats">
          <div class="stat-item">
            <div class="stat-value">${p.vacancy_count}</div>
            <div class="stat-label">Вакансий</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${p.median_salary ? p.median_salary.toLocaleString()+" ₸" : "Н/Д"}</div>
            <div class="stat-label">Медианная з/п</div>
          </div>
        </div>
        <div>
          <span class="trend ${trendClass}">${p.trend}</span>
        </div>
        <div class="skills-list">
          <h4>Навыки:</h4>
          <div class="skills">
            ${p.top_skills.map(s => `<span class="skill">${s}</span>`).join("")}
          </div>
        </div>
        <a href="${p.search_url}" target="_blank" style="color:var(--primary);">🔍 Вакансии</a>
      `;
      container.appendChild(card);
    });
  }

  // === Графики ===
  function createCharts(data) {
    const vacCtx = document.getElementById("vacancy-chart").getContext("2d");
    const salCtx = document.getElementById("salary-chart").getContext("2d");

    if (vacancyChart) vacancyChart.destroy();
    if (salaryChart) salaryChart.destroy();

    vacancyChart = new Chart(vacCtx, {
      type: "bar",
      data: {
        labels: data.map(p => p.profession),
        datasets: [{
          label: "Количество вакансий",
          data: data.map(p => p.vacancy_count),
          backgroundColor: "rgba(0, 247, 255, 0.7)"
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    salaryChart = new Chart(salCtx, {
      type: "bar",
      data: {
        labels: data.map(p => p.profession),
        datasets: [
          { label: "Средняя з/п", data: data.map(p => p.average_salary || 0), backgroundColor: "rgba(123,45,255,0.7)" },
          { label: "Медианная з/п", data: data.map(p => p.median_salary || 0), backgroundColor: "rgba(255,0,247,0.7)" }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // === Бургер-меню ===
  const burger = document.getElementById("burger");
  const menu = document.querySelector(".dark-header .menu");
  if (burger) {
    burger.addEventListener("click", () => menu.classList.toggle("open"));
  }

  initializeTabs();
});
