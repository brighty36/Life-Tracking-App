// Lightweight shared calendar date picker — attach to any readonly date input

let calEl        = null;
let currentInput = null;
let calYear      = null;
let calMonth     = null;

const MONTHS = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];

function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() { return new Date().toISOString().split('T')[0]; }

function endOfWeek() {
  const d   = new Date();
  const day = d.getDay(); // 0=Sun
  const toSun = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + toSun);
  return d.toISOString().split('T')[0];
}

function build() {
  if (calEl) return;
  calEl = document.createElement('div');
  calEl.className = 'cal-picker hidden';
  calEl.innerHTML = `
    <div class="cal-nav">
      <button class="cal-nav-btn" id="_cal-prev">&#8249;</button>
      <span class="cal-label" id="_cal-label"></span>
      <button class="cal-nav-btn" id="_cal-next">&#8250;</button>
    </div>
    <div class="cal-day-names">
      <span>Mo</span><span>Tu</span><span>We</span><span>Th</span>
      <span>Fr</span><span>Sa</span><span>Su</span>
    </div>
    <div class="cal-days" id="_cal-days"></div>
  `;
  document.body.appendChild(calEl);

  calEl.querySelector('#_cal-prev').addEventListener('click', e => {
    e.stopPropagation();
    calMonth -= 1;
    if (calMonth < 0) { calMonth = 11; calYear -= 1; }
    renderGrid();
  });
  calEl.querySelector('#_cal-next').addEventListener('click', e => {
    e.stopPropagation();
    calMonth += 1;
    if (calMonth > 11) { calMonth = 0; calYear += 1; }
    renderGrid();
  });

  document.addEventListener('click', e => {
    if (calEl && !calEl.contains(e.target) && e.target !== currentInput) hide();
  }, true);
}

function renderGrid() {
  calEl.querySelector('#_cal-label').textContent = `${MONTHS[calMonth]} ${calYear}`;
  const today    = todayStr();
  const selected = currentInput ? currentInput.value : '';
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const offset   = firstDay === 0 ? 6 : firstDay - 1; // Mon-based offset

  let html = '';
  for (let i = 0; i < offset; i++) html += '<span class="cal-empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
    const cls = [
      'cal-day',
      ds === today    ? 'cal-today'    : '',
      ds === selected ? 'cal-selected' : '',
    ].filter(Boolean).join(' ');
    html += `<button type="button" class="${cls}" data-date="${ds}">${d}</button>`;
  }

  const grid = calEl.querySelector('#_cal-days');
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-day').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      select(btn.dataset.date);
    });
  });
}

function select(dateStr) {
  if (currentInput) {
    currentInput.value = dateStr;
    currentInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
  hide();
}

function show(input) {
  build();
  currentInput = input;
  const val = input.value;
  if (val) {
    const d = new Date(val + 'T00:00:00');
    calYear  = d.getFullYear();
    calMonth = d.getMonth();
  } else {
    const d = new Date();
    calYear  = d.getFullYear();
    calMonth = d.getMonth();
  }
  renderGrid();

  const rect = input.getBoundingClientRect();
  calEl.style.top  = `${rect.bottom + window.scrollY + 4}px`;
  calEl.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 260)}px`;
  calEl.classList.remove('hidden');
}

function hide() {
  if (calEl) calEl.classList.add('hidden');
  currentInput = null;
}

export function attachCalendar(input) {
  input.readOnly = true;
  input.style.cursor = 'pointer';
  input.placeholder = input.placeholder || 'Pick a date…';
  input.addEventListener('click', e => {
    e.stopPropagation();
    if (currentInput === input && calEl && !calEl.classList.contains('hidden')) hide();
    else show(input);
  });
}

export { todayStr, endOfWeek };
