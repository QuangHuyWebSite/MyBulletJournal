// 1. Cấu hình CSDL IndexedDB
const db = new Dexie('BuJoProDB');
db.version(1).stores({
  notes: '++id, text, type, status, createdAt',
  habits: '++id, name, checks', // checks dạng { "2026-09-01": true }
  collections: '++id, title, items'
});

// Chống dọn bộ nhớ
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}

// Đăng ký Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// 2. Chuyển Tab
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`sec-${btn.dataset.tab}`).classList.add('active');
  });
});

// --- PHÂN HỆ 1: DAILY LOG (RAPID LOGGING) ---
const noteInput = document.getElementById('note-input');
const typeSelect = document.getElementById('type-select');
const bulletItems = document.getElementById('bullet-items');

async function renderDailyLog() {
  bulletItems.innerHTML = '';
  const notes = await db.notes.toArray();
  notes.forEach(note => {
    const li = document.createElement('li');
    li.className = 'bullet-item';
    
    let symbol = '•';
    if (note.type === 'event') symbol = 'o';
    if (note.type === 'note') symbol = '-';
    if (note.status === 'done') symbol = 'X';
    if (note.status === 'migrated') symbol = '>';

    li.innerHTML = `
      <span class="bullet-icon">${symbol}</span>
      <span class="bullet-text ${note.status === 'done' ? 'done' : ''}">${note.text}</span>
    `;

    // Rapid Logging xoay vòng trạng thái: • -> X -> > -> •
    li.querySelector('.bullet-icon').addEventListener('click', async () => {
      if (note.type !== 'task') return;
      let nextStatus = 'pending';
      if (note.status === 'pending') nextStatus = 'done';
      else if (note.status === 'done') nextStatus = 'migrated';
      else if (note.status === 'migrated') nextStatus = 'pending';

      await db.notes.update(note.id, { status: nextStatus });
      renderDailyLog();
    });

    bulletItems.appendChild(li);
  });
}

document.getElementById('add-btn').addEventListener('click', async () => {
  const text = noteInput.value.trim();
  if (!text) return;
  await db.notes.add({ text, type: typeSelect.value, status: 'pending', createdAt: new Date() });
  noteInput.value = '';
  renderDailyLog();
});

// --- PHÂN HỆ 2: HABIT TRACKER ---
async function renderHabitTracker() {
  const habits = await db.habits.toArray();
  const headerRow = document.getElementById('habit-header-row');
  const tbody = document.getElementById('habit-body');
  
  headerRow.innerHTML = '<th>Thói quen</th>';
  tbody.innerHTML = '';

  // Render 7 ngày gần nhất
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push(dateStr);
    headerRow.innerHTML += `<th>${d.getDate()}/${d.getMonth()+1}</th>`;
  }

  habits.forEach(habit => {
    const tr = document.createElement('tr');
    let html = `<td><strong>${habit.name}</strong></td>`;
    days.forEach(day => {
      const isChecked = habit.checks && habit.checks[day];
      html += `<td class="habit-check" data-id="${habit.id}" data-day="${day}">${isChecked ? '✔' : '⚪'}</td>`;
    });
    tr.innerHTML = html;
    tbody.appendChild(tr);
  });

  // Tải sự kiện tích chọn
  document.querySelectorAll('.habit-check').forEach(td => {
    td.addEventListener('click', async () => {
      const id = parseInt(td.dataset.id);
      const day = td.dataset.day;
      const habit = await db.habits.get(id);
      const checks = habit.checks || {};
      checks[day] = !checks[day];
      await db.habits.update(id, { checks });
      renderHabitTracker();
    });
  });
}

document.getElementById('add-habit-btn').addEventListener('click', async () => {
  const input = document.getElementById('habit-input');
  if (!input.value.trim()) return;
  await db.habits.add({ name: input.value.trim(), checks: {} });
  input.value = '';
  renderHabitTracker();
});

// --- PHÂN HỆ 3: COLLECTIONS ---
async function renderCollections() {
  const container = document.getElementById('collections-list');
  container.innerHTML = '';
  const cols = await db.collections.toArray();

  cols.forEach(col => {
    const card = document.createElement('div');
    card.className = 'collection-card';
    card.innerHTML = `<h3>${col.title}</h3><hr style="margin:8px 0;"><ul id="col-ul-${col.id}"></ul>`;
    container.appendChild(card);
  });
}

document.getElementById('add-col-btn').addEventListener('click', async () => {
  const input = document.getElementById('collection-input');
  if (!input.value.trim()) return;
  await db.collections.add({ title: input.value.trim(), items: [] });
  input.value = '';
  renderCollections();
});

// --- PHÂN HỆ 4: SAO LƯU & KHÔI PHỤC ---
document.getElementById('export-btn').addEventListener('click', async () => {
  const data = {
    notes: await db.notes.toArray(),
    habits: await db.habits.toArray(),
    collections: await db.collections.toArray()
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `bujo_pro_backup_${new Date().toISOString().slice(0,10)}.json`);
  a.click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.notes) { await db.notes.clear(); await db.notes.bulkAdd(data.notes); }
      if (data.habits) { await db.habits.clear(); await db.habits.bulkAdd(data.habits); }
      if (data.collections) { await db.collections.clear(); await db.collections.bulkAdd(data.collections); }
      location.reload();
    } catch (err) { alert('Tệp không hợp lệ!'); }
  };
  reader.readAsText(e.target.files[0]);
});

// Tải dữ liệu ban đầu
renderDailyLog();
renderHabitTracker();
renderCollections();