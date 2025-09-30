const area = document.getElementById('treeArea');
const svg = document.getElementById('treeSVG');
const startBtn = document.getElementById('startBtn');
const resultBox = document.getElementById('resultBox');
const vacanciesBox = document.getElementById('vacanciesBox');

window.addEventListener('DOMContentLoaded', () => {
  clearTree();
  growPath([], 0, 0, 0);
});


let maxDepth = 10;
let nodeWidth = 200, nodeHeight = 60, vSpace = 80, hSpace = 60;

function clearTree() {
  svg.innerHTML = '';
  Array.from(document.querySelectorAll('.tree-node')).forEach(el => el.remove());
  resultBox.classList.remove('show');
  resultBox.style.display = 'none';
  vacanciesBox.innerHTML = '';
  vacanciesBox.style.display = 'none';
}

function genId() {
  return '_' + Math.random().toString(36).slice(2,9);
}

async function fetchNode(path) {
  const res = await fetch('/ai-tree/api/node', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({path}),
  });
  return await res.json();
}

async function fetchResult(path) {
  const res = await fetch('/ai-tree/api/result', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({path}),
  });
  return await res.json();
}

function drawLoaderNode(nodeId, x, y) {
  const nodeDiv = document.createElement('div');
  nodeDiv.className = 'tree-node active';
  nodeDiv.style.left = `${area.offsetWidth/2 + x}px`;
  nodeDiv.style.top = `${40 + y}px`;
  nodeDiv.id = 'n_' + nodeId;
  nodeDiv.innerHTML = `<div class="inline-loader"></div>`;
  area.appendChild(nodeDiv);
}

function drawNode(node) {
  const nodeDiv = document.createElement('div');
  nodeDiv.className = 'tree-node active';
  nodeDiv.style.left = `${area.offsetWidth/2 + node.x}px`;
  nodeDiv.style.top = `${40 + node.y}px`;
  nodeDiv.id = 'n_' + node.id;
  nodeDiv.innerHTML = `<div>${node.question}</div>`;
  area.appendChild(nodeDiv);
}

function drawLine(x1, y1, x2, y2) {
  const line = document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', '#5b69c7');
  line.setAttribute('stroke-width', '2.2');
  line.setAttribute('opacity', '0.38');
  svg.appendChild(line);
}

async function growPath(path = [], depth = 0, x = 0, y = 0, retry = 0) {
  if (depth >= maxDepth) return;

  // 1. Покажи лоадер-блок
  const nodeId = genId();
  drawLoaderNode(nodeId, x, y);

  let question, options;
  try {
    const gpt = await fetchNode(path);
    question = gpt.question;
    options = gpt.options;
    if (!options || options.length < 2 || !options[0] || !options[1]) {
      if (retry < 3) {
        document.getElementById('n_' + nodeId).remove();
        return growPath(path, depth, x, y, retry + 1);
      } else {
        question = "Не удалось сгенерировать вопрос.";
        options = ["Ошибка", "Ошибка"];
      }
    }
  } catch (e) {
    question = "Ошибка при получении вопроса!";
    options = ["Ошибка", "Ошибка"];
  }

  // 2. Убери лоадер, покажи реальный вопрос с кнопками
  document.getElementById('n_' + nodeId).remove();

  drawNode({
    id: nodeId,
    question, options,
    x, y,
    depth
  });

  // Контейнер для кнопок (горизонтально)
  const nodeDiv = document.getElementById('n_' + nodeId);
  const btnContainer = document.createElement('div');
  btnContainer.style.display = 'flex';
  btnContainer.style.justifyContent = 'center';
  btnContainer.style.gap = '14px';

  for (let i = 0; i < 2; ++i) {
    const btn = document.createElement('button');
    btn.textContent = options[i];
    btn.onclick = async () => {
      btn.disabled = true;
      btnContainer.querySelectorAll('button').forEach(b=>b.disabled = true);

      let newPath = [...path, {question, answer: options[i]}];

      if (newPath.length >= maxDepth) {
        // Показываем мини-лоадер в блоке результата
        resultBox.textContent = '';
        resultBox.classList.remove('show');
        resultBox.innerHTML = '<div class="inline-loader"></div>';
        resultBox.style.display = 'block';

        vacanciesBox.style.display = 'none';
        vacanciesBox.innerHTML = '';

        const data = await fetchResult(newPath);

        resultBox.innerHTML = '';
        resultBox.textContent = data.profession;
        resultBox.classList.add('show');

        // --- Найти профессию по паттерну
        let professionTitle = '';
        const match = data.profession.match(/^Профессия:\s*([^\n]+)/i);
        if (match) {
          professionTitle = match[1].trim();
        }
        if (professionTitle) {
          showVacancies(professionTitle);
        }
        return;
      }

      let direction = ((depth + 1) % 2 === 0) ? 1 : -1;
      let nextX = x + direction * 250;
      let nextY = y + nodeHeight + vSpace;

      growPath(newPath, depth + 1, nextX, nextY);

      setTimeout(() => {
        drawLine(
          area.offsetWidth/2 + x + nodeWidth/2,
          40 + y + nodeHeight,
          area.offsetWidth/2 + nextX + nodeWidth/2,
          40 + nextY
        );
      }, 0);
    };
    btnContainer.appendChild(btn);
  }
  nodeDiv.appendChild(btnContainer);
}

// Вывод вакансий
async function showVacancies(professionTitle) {
  vacanciesBox.style.display = 'block';
  vacanciesBox.innerHTML = `<div class="inline-loader"></div>`;
  try {
    const res = await fetch('/ai-tree/api/vacancies', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({profession: professionTitle})
    });
    const data = await res.json();
    if (data.vacancies.length === 0) {
      vacanciesBox.innerHTML = '<b>Вакансии не найдены.</b>';
      return;
    }
    vacanciesBox.innerHTML = `<b>Актуальные вакансии на hh.kz:</b><ul>` +
      data.vacancies.map(v => `
        <li>
          <a href="${v.url}" target="_blank">${v.name}</a>
          <span> — ${v.company || 'Без компании'} ${v.salary ? `(Зарплата: ${v.salary})` : ''}</span>
        </li>
      `).join('') +
      `</ul>`;
  } catch(e) {
    vacanciesBox.innerHTML = '<b>Не удалось загрузить вакансии :(</b>';
  }
}

// startBtn.onclick = () => {
//   clearTree();
//   growPath([], 0, 0, 0);
// };
