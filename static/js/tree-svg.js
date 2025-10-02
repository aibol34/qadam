console.log("tree-svg.js подключен ✅");

class CareerTree {
  constructor() {
    this.startBtn = document.getElementById("startBtn");
    this.treeArea = document.getElementById("treeArea");
    this.resultBox = document.getElementById("resultBox");
    this.vacanciesBox = document.getElementById("vacanciesBox");

    this.progressBar = document.getElementById("progressBar");
    this.progressFill = document.getElementById("progressFill");

    this.path = [];
    this.maxQuestions = 10; // количество шагов

    if (this.startBtn) {
      this.startBtn.addEventListener("click", () => this.startJourney());
    }
  }

  // запуск дерева
  startJourney() {
    this.startBtn.style.display = "none";
    this.progressBar.style.display = "block";

    this.showLoading("Генерируется первый вопрос...");
    setTimeout(() => {
      this.updateProgress();
      this.fetchNextNode();
    }, 1000);
  }

  // показать блок загрузки снизу
  showLoading(text = "Генерация...") {
    let loadingBox = document.getElementById("loadingBox");

    if (!loadingBox) {
      loadingBox = document.createElement("div");
      loadingBox.id = "loadingBox";
      loadingBox.className = "loading-box";
      loadingBox.innerHTML = `
        <div class="spinner"></div>
        <p>${text}</p>
      `;
      this.treeArea.appendChild(loadingBox);
    } else {
      loadingBox.querySelector("p").textContent = text;
      this.treeArea.appendChild(loadingBox);
    }

    loadingBox.style.display = "block";
    loadingBox.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  // скрыть блок загрузки
  hideLoading() {
    const loadingBox = document.getElementById("loadingBox");
    if (loadingBox) {
      loadingBox.style.display = "none";
    }
  }

  // запрос следующего вопроса
  async fetchNextNode() {
    try {
      const response = await fetch("/ai-tree/api/node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: this.path })
      });

      if (!response.ok) throw new Error(`Ошибка: ${response.status}`);

      const data = await response.json();
      this.hideLoading();
      this.renderQuestion(data.question, data.options);

    } catch (err) {
      console.error(err);
      this.hideLoading();
      this.showError("Не удалось загрузить вопрос");
    }
  }

  // вывод вопроса и вариантов
  renderQuestion(question, options) {
    const qBox = document.createElement("div");
    qBox.className = "ai-question-box";

    const qText = document.createElement("h3");
    qText.textContent = question;
    qBox.appendChild(qText);

    options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "ai-answer-btn";
      btn.textContent = option;

      btn.addEventListener("click", () => {
        this.handleAnswer(question, option, btn, qBox);
      });

      qBox.appendChild(btn);
    });

    this.treeArea.appendChild(qBox);

    // плавный скролл к новому вопросу
    qBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // обработка выбора ответа
  async handleAnswer(question, answer, selectedBtn, qBox) {
    this.path.push({ question, answer });

    // выбранный зелёный
    selectedBtn.classList.add("selected");

    // блокировка всех кнопок
    const btns = qBox.querySelectorAll("button");
    btns.forEach(b => {
      b.disabled = true;
      if (b !== selectedBtn) {
        b.classList.add("disabled"); // остальные серые
      }
    });

    // обновляем прогресс
    this.updateProgress();

    // показать загрузку перед следующим вопросом
    this.showLoading("Генерируется следующий вопрос...");

    setTimeout(() => {
      if (this.path.length >= this.maxQuestions) {
        this.fetchResult();
      } else {
        this.fetchNextNode();
      }
    }, 1200);
  }

  // запрос результата
  async fetchResult() {
    try {
      const [professionData, vacanciesData] = await Promise.all([
        this.fetchProfession(),
        this.fetchVacancies()
      ]);

      this.hideLoading();
      this.displayResult(professionData.profession);
      this.displayVacancies(vacanciesData.vacancies);

    } catch (err) {
      console.error(err);
      this.hideLoading();
      this.showError("Ошибка при получении результата");
    }
  }

  // запрос профессии
  async fetchProfession() {
    const response = await fetch("/ai-tree/api/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: this.path })
    });
    return await response.json();
  }

  // запрос вакансий
  async fetchVacancies() {
    const profession = this.path[this.path.length - 1]?.answer || "";
    const response = await fetch("/ai-tree/api/vacancies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profession })
    });
    return await response.json();
  }

  // вывод результата
  displayResult(profession) {
    this.resultBox.innerHTML = `<h2>Ваш результат</h2><p>${profession}</p>`;
    this.resultBox.classList.add("show");
    this.resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // вывод вакансий
  displayVacancies(vacancies) {
    if (!vacancies || vacancies.length === 0) {
      this.vacanciesBox.innerHTML = "<h3>Вакансии не найдены</h3>";
      return;
    }

    this.vacanciesBox.innerHTML = `
      <h3>Актуальные вакансии</h3>
      <ul class="vacancies-list">
        ${vacancies.map(v => `
          <li class="vacancy-item">
            <a href="${v.url}" target="_blank">${v.name}</a> — ${v.company}
            (${v.salary || "з/п не указана"})
          </li>
        `).join("")}
      </ul>
    `;

    this.vacanciesBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // прогресс
  updateProgress() {
    if (!this.progressFill) return;
    const percent = Math.round((this.path.length / this.maxQuestions) * 100);
    this.progressFill.style.width = percent + "%";
  }

  // ошибки
  showError(msg) {
    const div = document.createElement("div");
    div.className = "error-message";
    div.textContent = msg;
    this.treeArea.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }
}

document.addEventListener("DOMContentLoaded", () => new CareerTree());
