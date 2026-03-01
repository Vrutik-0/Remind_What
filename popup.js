'use strict';
const $  = id => document.getElementById(id);
const pad = n  => String(n).padStart(2, '0');

function hmsFromSeconds(total) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s };
}

function formatHMS(total) {
  const { h, m, s } = hmsFromSeconds(total);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatInterval(interval, unit) {
  const labels = { seconds: 's', minutes: 'min', hours: 'hr' };
  return `${interval} ${labels[unit] ?? unit}`;
}

// Live clock in header
function updateClock() {
  const now = new Date();
  $('liveClock').textContent = now.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}
setInterval(updateClock, 1000);
updateClock();

//Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    $('panel-' + tabId).classList.remove('hidden');
  });
});

const STORAGE_KEY = 'remindme_reminders';

// Convert unit to minutes for chrome.alarms
function toAlarmMinutes(interval, unit) {
  if (unit === 'seconds') return interval / 60;
  if (unit === 'hours')   return interval * 60;
  return interval; // minutes
}

// Load reminders from storage and render
function loadReminders() {
  chrome.storage.local.get([STORAGE_KEY], result => {
    const reminders = result[STORAGE_KEY] || [];
    renderReminders(reminders);
  });
}

// Save reminder array to storage
function saveReminders(reminders) {
  chrome.storage.local.set({ [STORAGE_KEY]: reminders });
}

// Add reminder
$('btnAddReminder').addEventListener('click', () => {
  const name     = $('rName').value.trim();
  const interval = parseInt($('rInterval').value);
  const unit     = $('rUnit').value;

  if (!name)                    return showError('rName',     'Enter a name.');
  if (!interval || interval < 1) return showError('rInterval', 'Enter a valid interval.');

  const id = `reminder_${Date.now()}`;
  const reminder = { id, name, interval, unit, createdAt: Date.now(), paused: false };

  // Create repeating alarm (fires while popup is closed too)
  chrome.alarms.create(id, {
    delayInMinutes:  toAlarmMinutes(interval, unit),
    periodInMinutes: toAlarmMinutes(interval, unit)
  });

  chrome.storage.local.get([STORAGE_KEY], result => {
    const reminders = result[STORAGE_KEY] || [];
    reminders.push(reminder);
    saveReminders(reminders);
    renderReminders(reminders);
  });

  $('rName').value     = '';
  $('rInterval').value = '';
  $('rName').focus();
});

// Toggle pause / resume
function toggleReminder(id) {
  chrome.storage.local.get([STORAGE_KEY], result => {
    const reminders = result[STORAGE_KEY] || [];
    const r = reminders.find(x => x.id === id);
    if (!r) return;

    r.paused = !r.paused;

    if (r.paused) {
      chrome.alarms.clear(id);
    } else {
      chrome.alarms.create(id, {
        delayInMinutes:  toAlarmMinutes(r.interval, r.unit),
        periodInMinutes: toAlarmMinutes(r.interval, r.unit)
      });
    }

    saveReminders(reminders);
    renderReminders(reminders);
  });
}

// Delete reminder
function deleteReminder(id) {
  chrome.alarms.clear(id);
  chrome.storage.local.get([STORAGE_KEY], result => {
    const reminders = (result[STORAGE_KEY] || []).filter(x => x.id !== id);
    saveReminders(reminders);
    renderReminders(reminders);
  });
}

// Render the list
function renderReminders(reminders) {
  const list  = $('reminderList');
  const empty = $('reminderEmpty');

  // Remove old cards (not the empty state node)
  list.querySelectorAll('.reminder-card').forEach(el => el.remove());

  if (!reminders.length) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  reminders.forEach(r => {
    const card = document.createElement('div');
    card.className = `reminder-card${r.paused ? ' paused' : ''}`;
    card.id = `rcard-${r.id}`;

    card.innerHTML = `
      <div class="r-dot"></div>
      <div class="r-info">
        <div class="r-name">${escapeHtml(r.name)}</div>
        <div class="r-meta">Every ${formatInterval(r.interval, r.unit)} · ${r.paused ? 'Paused' : 'Active'}</div>
      </div>
      <div class="r-actions">
        <button class="r-btn pause-btn" title="${r.paused ? 'Resume' : 'Pause'}">
          ${r.paused ? '▶' : '⏸'}
        </button>
        <button class="r-btn del" title="Delete">🗑</button>
      </div>
    `;

    card.querySelector('.pause-btn').addEventListener('click', () => toggleReminder(r.id));
    card.querySelector('.del').addEventListener('click', () => deleteReminder(r.id));

    list.appendChild(card);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Load on popup open
loadReminders();

// Show error by highlighting field and setting title
function showError(fieldId, msg) {
  const field = $(fieldId);
  field.style.borderColor = '#dc2626';
  field.focus();
  field.title = msg;
  setTimeout(() => {
    field.style.borderColor = '';
    field.title = '';
  }, 2000);
}

// Timer logic below 

const CIRCUMFERENCE = 2 * Math.PI * 58; // matches r="58"
const TIMER_ALARM_KEY = 'timer_alarm';

let timerTotal     = 0;
let timerRemaining = 0;
let timerInterval  = null;
let timerRunning   = false;

// Read saved timer state (in case popup was closed mid-timer)
function loadTimerState() {
  chrome.storage.local.get(['remindme_timer'], result => {
    const state = result.remindme_timer;
    if (!state || !state.running) return;

    const elapsed  = Math.floor((Date.now() - state.startedAt) / 1000);
    const remaining = Math.max(0, state.total - elapsed);

    if (remaining > 0) {
      timerTotal     = state.total;
      timerRemaining = remaining;
      $('timerLabel').value = state.label || '';
      updateTimerUI();
      resumeTimerInterval();
    } else {
      clearTimerState();
    }
  });
}

function saveTimerState() {
  chrome.storage.local.set({
    remindme_timer: {
      total:     timerTotal,
      remaining: timerRemaining,
      startedAt: Date.now() - ((timerTotal - timerRemaining) * 1000),
      running:   timerRunning,
      label:     $('timerLabel').value || ''
    }
  });
}

function clearTimerState() {
  chrome.storage.local.remove('remindme_timer');
}

// Update display & ring
function updateTimerUI() {
  $('timerDisplay').textContent = formatHMS(timerRemaining);
  const offset = CIRCUMFERENCE * (1 - (timerRemaining / (timerTotal || 1)));
  $('ringFill').style.strokeDashoffset = offset;
}

function resumeTimerInterval() {
  timerRunning = true;
  $('timerDisplay').className = 'timer-clock running';
  $('timerSub').textContent   = $('timerLabel').value.toUpperCase() || 'RUNNING';
  $('btnStart').classList.add('hidden');
  $('btnPause').classList.remove('hidden');

  timerInterval = setInterval(() => {
    timerRemaining--;
    updateTimerUI();

    if (timerRemaining <= 0) {
      finishTimer();
    }
  }, 1000);
}

// Start 
$('btnStart').addEventListener('click', () => {
  if (timerRunning) return;

  if (timerRemaining === 0) {
    const hh = parseInt($('tHH').value) || 0;
    const mm = parseInt($('tMM').value) || 0;
    const ss = parseInt($('tSS').value) || 0;
    timerTotal     = hh * 3600 + mm * 60 + ss;
    timerRemaining = timerTotal;
    if (timerTotal <= 0) return showError('tMM', 'Set a duration.');
  }

  updateTimerUI();
  resumeTimerInterval();
  saveTimerState();

  // Register background alarm as fallback notification
  const label     = $('timerLabel').value || 'Timer';
  const delayMins = timerRemaining / 60;
  chrome.alarms.clear(TIMER_ALARM_KEY, () => {
    chrome.alarms.create(TIMER_ALARM_KEY, { delayInMinutes: delayMins });
  });

  // Tell background the label
  chrome.storage.local.set({ remindme_timer_label: label });
});

// Pause 
$('btnPause').addEventListener('click', () => {
  clearInterval(timerInterval);
  timerRunning = false;

  $('timerDisplay').className = 'timer-clock';
  $('timerSub').textContent   = 'PAUSED';
  $('btnStart').textContent   = '▶ Resume';
  $('btnStart').classList.remove('hidden');
  $('btnPause').classList.add('hidden');

  // Cancel the background alarm (we're paused)
  chrome.alarms.clear(TIMER_ALARM_KEY);
  clearTimerState();
});

// Reset 
$('btnReset').addEventListener('click', resetTimer);

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning   = false;
  timerTotal     = 0;
  timerRemaining = 0;

  $('timerDisplay').textContent = '00:00:00';
  $('timerDisplay').className   = 'timer-clock';
  $('timerSub').textContent     = 'READY';
  $('ringFill').style.strokeDashoffset = '0';
  $('ringFill').setAttribute('class', 'ring-fill');
  $('btnStart').textContent     = '▶ Start';
  $('btnStart').classList.remove('hidden');
  $('btnPause').classList.add('hidden');

  $('tHH').value = '';
  $('tMM').value = '';
  $('tSS').value = '';
  $('timerLabel').value = '';

  chrome.alarms.clear(TIMER_ALARM_KEY);
  clearTimerState();
}

// Finish 
function finishTimer() {
  clearInterval(timerInterval);
  timerRunning = false;

  $('timerDisplay').className = 'timer-clock done';
  $('timerSub').textContent   = 'DONE ✓';
  $('ringFill').setAttribute('class', 'ring-fill done');
  $('btnStart').classList.remove('hidden');
  $('btnStart').textContent   = '▶ Start';
  $('btnPause').classList.add('hidden');

  clearTimerState();
  chrome.alarms.clear(TIMER_ALARM_KEY);
}

// Restore timer if popup re-opened mid-countdown
loadTimerState();
