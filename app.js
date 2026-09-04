// 1. Khởi tạo Cơ sở dữ liệu IndexedDB
const db = new Dexie('BuJoDatabase');
db.version(1).stores({
  notes: '++id, text, type, status, createdAt'
});

// 2. Yêu cầu Trình duyệt KHÔNG TỰ ĐỘNG XÓA dữ liệu (Persistent Storage)
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(isPersisted => {
    console.log(`Chế độ lưu trữ vĩnh viễn: ${isPersisted ? "BẬT" : "TẮT"}`);
  });
}

// 3. Đăng ký Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log('Service Worker đã hoạt động!'));
}

// Elements
const noteInput = document.getElementById('note-input');
const typeSelect = document.getElementById('type-select');
const addBtn = document.getElementById('add-btn');
const bulletItems = document.getElementById('bullet-items');
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');

// 4. Render danh sách ghi chú
async function renderNotes() {
  bulletItems.innerHTML = '';
  const notes = await db.notes.toArray();
  
  notes.forEach(note => {
    const li = document.createElement('li');
    li.className = `bullet-item ${note.status === 'done' ? 'done' : ''}`;
    
    let symbol = '•';
    if (note.type === 'event') symbol = 'o';
    if (note.type === 'note') symbol = '-';
    if (note.status === 'done') symbol = 'X';

    li.innerHTML = `
      <span class="bullet-icon">${symbol}</span>
      <span class="bullet-text">${note.text}</span>
    `;

    // Toggle trạng thái Hoàn thành (X)
    li.addEventListener('click', async () => {
      const newStatus = note.status === 'done' ? 'pending' : 'done';
      await db.notes.update(note.id, { status: newStatus });
      renderNotes();
    });

    bulletItems.appendChild(li);
  });
}

// 5. Thêm ghi chú
addBtn.addEventListener('click', async () => {
  const text = noteInput.value.trim();
  if (!text) return;

  await db.notes.add({
    text: text,
    type: typeSelect.value,
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  noteInput.value = '';
  renderNotes();
});

// 6. Tính năng Sao lưu (Export JSON)
exportBtn.addEventListener('click', async () => {
  const allNotes = await db.notes.toArray();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allNotes));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `bujo_backup_${new Date().toISOString().slice(0,10)}.json`);
  downloadAnchor.click();
});

// 7. Tính năng Khôi phục (Import JSON)
importFile.addEventListener('change', (e) => {
  const fileReader = new FileReader();
  fileReader.onload = async function(event) {
    try {
      const notes = JSON.parse(event.target.result);
      await db.notes.clear(); // Xóa dữ liệu cũ
      await db.notes.bulkAdd(notes); // Nạp dữ liệu mới
      renderNotes();
      alert('Khôi phục dữ liệu thành công!');
    } catch (err) {
      alert('File JSON không hợp lệ!');
    }
  };
  fileReader.readAsText(e.target.files[0]);
});

renderNotes();