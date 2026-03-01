# RemindMe — Chrome Extension

A clean, lightweight Chrome extension for recurring reminders and countdown timers with desktop notifications.

---

## File Structure

```
remindme-ext/
├── manifest.json      ← Extension config (Manifest V3)
├── popup.html         ← Extension popup UI
├── popup.css          ← All styles (no frameworks)
├── popup.js           ← Popup logic: tabs, reminders, timer
├── background.js      ← Service worker: alarm events → notifications
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## How to Install in Chrome

1. Open Chrome and go to: `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **"Load unpacked"**
4. Select the `remindme-ext/` folder
5. The extension icon will appear in your toolbar — click it!

---

## Features

### 🔔 Reminders
- Add named reminders with a custom interval (seconds / minutes / hours)
- Each reminder repeats on schedule using `chrome.alarms`
- Fires a **desktop notification** even when the popup is closed
- Pause / Resume / Delete individual reminders
- Reminders persist across browser restarts via `chrome.storage.local`

### ⏱ Timer
- Set HH:MM:SS duration with an optional label
- Animated SVG ring that drains as time counts down
- Start / Pause / Resume / Reset controls
- A background alarm fires a **desktop notification** if you close the popup
- Timer state is saved and restored if you reopen the popup mid-countdown

---

## Permissions Used

| Permission     | Reason                                       |
|----------------|----------------------------------------------|
| `alarms`       | Schedule repeating / one-shot alarms         |
| `notifications`| Show desktop pop-up notifications            |
| `storage`      | Persist reminders and timer state            |
