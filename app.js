// 1. Khởi tạo Cơ sở dữ liệu
const db = new Dexie('BuJoFixDB');
db.version(1).stores({
  notes: '++id, text, type, status, createdAt',
  habits: '++id, name, checks',
  collections: '++id, title'
});

// Chống xóa bộ nhớ
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}

// 2. HÀM CHUYỂN TAB (SỬA LỖI TAB BỊ LIỆT)
function switchTab(tabName) {
  // Ẩn toàn bộ tab
  const allContents = document.querySelectorAll('.tab-content');
  allContents.forEach(content => {
    content.classList.remove('active');
  });

  // Bỏ active nút cũ
  const allButtons = document.querySelectorAll('.tab-btn');
  allButtons.forEach(btn => {
    btn.classList.remove('active');
  });

  // Bật tab được chọn
  const selectedContent = document.getElementById(`sec-${tabName}`);
  if (selectedContent) {
    selectedContent.classList.add('active');
  }

  // Active nút được chọn
  event.currentTarget.classList.add('active');
}

// 3. DAILY LOG (RAPID LOGGING)
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

    // Nhấp vào hạt Bullet đổi trạng thái: • -> X -> > -> •
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

// 4. HABIT TRACKER
async function renderHabits() {
  const habits = await db.habits.toArray();
  const headerRow = document.getElementById('habit-header-row');
  const tbody = document.getElementById('habit-body');
  
  headerRow.innerHTML = '<th>Thói quen</th>';
  tbody.innerHTML = '';

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
      html += `<td class="habit-check" onclick="toggleHabit(${habit.id}, '${day}')">${isChecked ? '✔' : '⚪'}</td>`;
    });
    tr.innerHTML = html;
    tbody.appendChild(tr);
  });
}

async function toggleHabit(id, day) {
  const habit = await db.habits.get(id);
  const checks = habit.checks || {};
  checks[day] = !checks[day];
  await db.habits.update(id, { checks });
  renderHabits();
}

document.getElementById('add-habit-btn').addEventListener('click', async () => {
  const input = document.getElementById('habit-input');
  if (!input.value.trim()) return;
  await db.habits.add({ name: input.value.trim(), checks: {} });
  input.value = '';
  renderHabits();
});

// 5. COLLECTIONS
async function renderCollections() {
  const container = document.getElementById('collections-list');
  container.innerHTML = '';
  const cols = await db.collections.toArray();
  cols.forEach(col => {
    const card = document.createElement('div');
    card.className = 'collection-card';
    card.innerHTML = `<h3>📌 ${col.title}</h3>`;
    container.appendChild(card);
  });
}

document.getElementById('add-col-btn').addEventListener('click', async () => {
  const input = document.getElementById('collection-input');
  if (!input.value.trim()) return;
  await db.collections.add({ title: input.value.trim() });
  input.value = '';
  renderCollections();
});

// 6. SAO LƯU & KHÔI PHỤC
document.getElementById('export-btn').addEventListener('click', async () => {
  const data = {
    notes: await db.notes.toArray(),
    habits: await db.habits.toArray(),
    collections: await db.collections.toArray()
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `bujo_backup_${new Date().toISOString().slice(0,10)}.json`);
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
      alert('Khôi phục dữ liệu thành công!');
      location.reload();
    } catch (err) { alert('Tệp JSON không hợp lệ!'); }
  };
  reader.readAsText(e.target.files[0]);
});

// Khởi chạy ban đầu
renderDailyLog();
renderHabits();
renderCollections();
