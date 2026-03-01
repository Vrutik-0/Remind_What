'use strict';

const STORAGE_KEY    = 'remindme_reminders';
const TIMER_ALARM    = 'timer_alarm';

// Listen for alarms (both timers and reminders)
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === TIMER_ALARM) {
    handleTimerAlarm();
  } else if (alarm.name.startsWith('reminder_')) {
    handleReminderAlarm(alarm.name);
  }
});

// Timer alarm handler
function handleTimerAlarm() {
  chrome.storage.local.get(['remindme_timer_label'], result => {
    const label = result.remindme_timer_label || 'Timer';
    showNotification(
      `timer_done_${Date.now()}`,
      ` "${label}" is done!`,
      'Your countdown timer has finished.'
    );
    chrome.storage.local.remove('remindme_timer');
  });
}

// Reminder alarm handler
function handleReminderAlarm(alarmName) {
  chrome.storage.local.get([STORAGE_KEY], result => {
    const reminders = result[STORAGE_KEY] || [];
    const r = reminders.find(x => x.id === alarmName);
    if (!r || r.paused) return;

    const unitLabel = { seconds: 's', minutes: 'min', hours: 'hr' }[r.unit] || r.unit;

    showNotification(
      `notif_${alarmName}_${Date.now()}`,
      ` ${r.name}`,
      `Time to: ${r.name} — every ${r.interval} ${unitLabel}.`
    );
  });
}

// Utility function to show notifications
function showNotification(id, title, message) {
  chrome.notifications.create(id, {
    type:     'basic',
    iconUrl:  'icons/icon48.png',
    title,
    message,
    priority: 2,
    requireInteraction: false
  });
}

// Show welcome notification on first install
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    showNotification(
      'welcome',
      ' RemindMe Installed!',
      'Click the extension icon to add reminders and timers.'
    );
  }
});
