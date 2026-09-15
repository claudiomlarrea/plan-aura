/** Simulated AI assistant with keyword retrieval over a local KB. */

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function scoreEntry(entry, query) {
  const q = normalize(query);
  let score = 0;
  for (const kw of entry.keywords) {
    if (q.includes(normalize(kw))) score += 2;
  }
  // light bonus if question words overlap
  for (const word of normalize(entry.question).split(/\s+/)) {
    if (word.length > 4 && q.includes(word)) score += 1;
  }
  return score;
}

export function matchAnswer(kb, query) {
  let best = null;
  let bestScore = 0;
  for (const entry of kb.entries) {
    const s = scoreEntry(entry, query);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }
  if (!best || bestScore < 2) {
    return { answer: kb.fallback, sources: [], question: query };
  }
  return { answer: best.answer, sources: best.sources, question: best.question, id: best.id };
}

function appendMessage(log, role, html) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = html;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

export function initAssistant(root, kb) {
  const log = root.querySelector("#chat-log");
  const form = root.querySelector("#chat-form");
  const input = root.querySelector("#chat-input");
  const quick = root.querySelector("#quick-asks");

  appendMessage(log, "bot", kb.greeting);

  quick.innerHTML = kb.entries
    .slice(0, 4)
    .map((e) => `<button type="button" data-q="${e.question.replace(/"/g, "&quot;")}">${e.question}</button>`)
    .join("");

  function ask(text) {
    const q = text.trim();
    if (!q) return;
    appendMessage(log, "user", q);
    const result = matchAnswer(kb, q);
    const sourcesHtml = result.sources?.length
      ? `<div class="sources"><strong>Fuentes demo:</strong> ${result.sources.join(" · ")}</div>`
      : "";
    // slight delay for "assistant" feel
    setTimeout(() => {
      appendMessage(log, "bot", `${result.answer}${sourcesHtml}`);
    }, 280);
  }

  quick.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-q]");
    if (!btn) return;
    ask(btn.getAttribute("data-q"));
  });

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    ask(input.value);
    input.value = "";
  });
}
