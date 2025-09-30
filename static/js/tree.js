const root = document.getElementById('treeRoot');
const startBtn = document.getElementById('startBtn');
const resultBox = document.getElementById('resultBox');

function createBranch(question, options, depth, path) {
  const branch = document.createElement('div');
  branch.className = 'branch';

  options.forEach(option => {
    const container = document.createElement('div');
    container.className = 'node';
    if (depth > 0) container.classList.add('dimmed');

    const qEl = document.createElement('div');
    qEl.className = 'question';
    qEl.textContent = question;
    container.appendChild(qEl);

    const btn = document.createElement('button');
    btn.textContent = option;
    btn.onclick = async () => {
      const allButtons = container.parentElement.querySelectorAll('button');
      allButtons.forEach(b => b.disabled = true);

      const newPath = [...path, { question, answer: option }];

      if (newPath.length >= 10) {
        const res = await fetch('/api/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: newPath })
        });
        const data = await res.json();
        resultBox.style.display = 'block';
        resultBox.textContent = data.profession;
        return;
      }

      const res = await fetch('/api/node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath })
      });

      const data = await res.json();
      const nextBranch = createBranch(data.question, data.options, newPath.length, newPath);
      container.appendChild(nextBranch);
      container.classList.remove('dimmed');
      container.classList.add('active');
    };
    container.appendChild(btn);
    branch.appendChild(container);
  });

  return branch;
}

async function startTree() {
  const res = await fetch('/api/node', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: [] })
  });
  const data = await res.json();
  const firstBranch = createBranch(data.question, data.options, 0, []);
  root.appendChild(firstBranch);
}

startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  resultBox.style.display = 'none';
  root.innerHTML = '';
  startTree();
});
