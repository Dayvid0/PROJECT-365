// background.js - Service worker for the extension
function createContextMenus() {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: 'ta_start', title: 'Typing Automator: Start typing', contexts: ['editable', 'page'] });
      chrome.contextMenus.create({ id: 'ta_start_html', title: 'Typing Automator: Start with formatting (HTML)', contexts: ['editable', 'page'] });
      chrome.contextMenus.create({ id: 'ta_stop', title: 'Typing Automator: Stop typing', contexts: ['editable', 'page'] });
    });
  } catch (e) {}
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Typing Automator extension installed');
  createContextMenus();
  
  // Set default storage values
  chrome.storage.local.get(['machine_code', 'activation_version'], (result) => {
    if (!result.activation_version) {
      chrome.storage.local.set({ activation_version: 0 });
    }
  });
});

chrome.runtime.onStartup && chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get_tab_info') {
    const tabId = sender.tab ? sender.tab.id : null;
    const url = sender.tab ? sender.tab.url : null;
    sendResponse({ 
      tabId: tabId,
      url: url 
    });
    return true;
  }

  // Broadcast a message to all frames in a tab (requires webNavigation permission)
  if (request.action === 'broadcast_to_frames') {
    const { tabId, message } = request;
    if (!tabId || !message) {
      sendResponse({ ok: false, error: 'Missing tabId or message' });
      return true;
    }

    try {
      chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
        if (chrome.runtime.lastError) {
          // Fallback: send to top frame only
          chrome.tabs.sendMessage(tabId, message, () => {
            sendResponse({ ok: false, error: chrome.runtime.lastError?.message || 'Sent to top frame only' });
          });
          return;
        }

        if (!frames || frames.length === 0) {
          chrome.tabs.sendMessage(tabId, message, () => sendResponse({ ok: true, frames: 0 }));
          return;
        }

        let sent = 0;
        let successes = 0;
        frames.forEach(f => {
          chrome.tabs.sendMessage(tabId, message, { frameId: f.frameId }, () => {
            // Consume errors to avoid Unchecked runtime.lastError noise
            if (!chrome.runtime.lastError) {
              successes++;
            } else {
              // Read lastError to prevent console warning
              const _ = chrome.runtime.lastError.message;
            }
            sent++;
            if (sent === frames.length) {
              sendResponse({ ok: successes > 0, frames: frames.length, delivered: successes });
            }
          });
        });
      });
    } catch (e) {
      // Safety fallback
      chrome.tabs.sendMessage(tabId, message, () => sendResponse({ ok: false, error: String(e) }));
    }
    return true; // keep sendResponse open
  }

  if (request.action === 'tinymce_main_type') {
    const payload = request.payload || {};
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'No tabId' });
      return true;
    }
    try {
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (p) => {
          (async () => {
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            // Try to get TinyMCE active editor for up to ~3s
            let ed = null;
            for (let i = 0; i < 60; i++) {
              ed = (window.tinymce && (
                (p.editorId && window.tinymce.get && window.tinymce.get(p.editorId)) ||
                (window.tinymce.EditorManager && p.editorId && window.tinymce.EditorManager.editors && window.tinymce.EditorManager.editors.find(e => e.id === p.editorId)) ||
                window.tinymce.activeEditor ||
                (window.tinymce.EditorManager && window.tinymce.EditorManager.activeEditor)
              )) || null;
              if (ed) break;
              await sleep(50);
            }
            // If still not found, try focusing editor iframe then retry briefly
            if (!ed) {
              const ifr = document.querySelector('iframe.tox-edit-area__iframe, #online-answersheet_ifr, iframe[title="Rich Text Area"]');
              if (ifr && ifr.contentWindow) {
                try { ifr.contentWindow.focus(); } catch (e) {}
                for (let i = 0; i < 20 && !ed; i++) {
                  ed = (window.tinymce && (
                    (p.editorId && window.tinymce.get && window.tinymce.get(p.editorId)) ||
                    (window.tinymce.EditorManager && p.editorId && window.tinymce.EditorManager.editors && window.tinymce.EditorManager.editors.find(e => e.id === p.editorId)) ||
                    window.tinymce.activeEditor ||
                    (window.tinymce.EditorManager && window.tinymce.EditorManager.activeEditor)
                  )) || null;
                  if (ed) break;
                  await sleep(50);
                }
              }
            }
            if (!ed) {
              window.postMessage({ __TA_TINYMCE_DONE: true, ok: false }, '*');
              return;
            }
            try {
              ed.focus();
              if (p.html) {
                ed.insertContent(p.html);
                window.postMessage({ __TA_TINYMCE_DONE: true, ok: true, mode: 'html' }, '*');
                return;
              }
              const text = p.text || '';
              let i = 0;
              const baseDelay = Math.max(5, 100 / (p.speed || 1));
              const step = async () => {
                if (i >= text.length) {
                  window.postMessage({ __TA_TINYMCE_DONE: true, ok: true, mode: 'text' }, '*');
                  return;
                }
                const ch = text[i++];
                if (ch === '\n') ed.insertContent('<br/>'); else ed.insertContent(ch);
                const delay = baseDelay + Math.random() * (baseDelay / 2);
                setTimeout(step, delay);
              };
              step();
            } catch (e) {
              window.postMessage({ __TA_TINYMCE_DONE: true, ok: false, error: String(e) }, '*');
            }
          })();
        },
        args: [payload]
      }, () => {
        // Consume errors
        if (chrome.runtime.lastError) {
          const _ = chrome.runtime.lastError.message;
          sendResponse({ ok: false, error: _ });
        } else {
          sendResponse({ ok: true });
        }
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }
  return true;
});

async function startTypingForTab(tabId, preferHtml) {
  const cfg = await chrome.storage.local.get(['savedText','savedHtml','savedSpeed','preserveHtml','selectedEditorId']);
  const text = cfg.savedText || '';
  const html = (preferHtml || cfg.preserveHtml) ? (cfg.savedHtml || '') : '';
  const speed = cfg.savedSpeed || 1.0;
  const editorId = cfg.selectedEditorId || null;

  // 1) Try main-world TinyMCE path
  try {
    await new Promise((resolve) => {
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (p) => {
          (async () => {
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            let ed = null;
            for (let i = 0; i < 60; i++) {
              ed = (window.tinymce && (
                (p.editorId && window.tinymce.get && window.tinymce.get(p.editorId)) ||
                (window.tinymce.EditorManager && p.editorId && window.tinymce.EditorManager.editors && window.tinymce.EditorManager.editors.find(e => e.id === p.editorId)) ||
                window.tinymce.activeEditor ||
                (window.tinymce.EditorManager && window.tinymce.EditorManager.activeEditor)
              )) || null;
              if (ed) break;
              await sleep(50);
            }
            if (!ed) return; // fallback to content script below
            try {
              ed.focus();
              if (p.html) {
                ed.insertContent(p.html);
                return;
              }
              const text = p.text || '';
              let i = 0;
              const baseDelay = Math.max(5, 100 / (p.speed || 1));
              const step = () => {
                if (i >= text.length) return;
                const ch = text[i++];
                if (ch === '\n') ed.insertContent('<br/>'); else ed.insertContent(ch);
                const delay = baseDelay + Math.random() * (baseDelay/2);
                setTimeout(step, delay);
              };
              step();
            } catch (e) {}
          })();
        },
        args: [{ text, html, speed, editorId }]
      }, () => resolve());
    });
  } catch (e) {}

  // 2) Broadcast to content scripts for generic typing (countdown 0)
  chrome.runtime.sendMessage({
    action: 'broadcast_to_frames',
    tabId,
    message: { action: 'start_typing', text, html, speed, editorId, countdown: 0 }
  });
}

// Context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === 'ta_start') {
    await startTypingForTab(tab.id, false);
  } else if (info.menuItemId === 'ta_start_html') {
    await startTypingForTab(tab.id, true);
  } else if (info.menuItemId === 'ta_stop') {
    chrome.runtime.sendMessage({ action: 'broadcast_to_frames', tabId: tab.id, message: { action: 'stop_typing' } });
  }
});

// Global keyboard shortcuts (work even if popup cannot open)
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tabs || tabs.length === 0) return;
    const tab = tabs[0];
    if (!tab || !tab.id) return;

    if (command === 'start-typing') {
      const cfg = await chrome.storage.local.get(['savedText','savedHtml','savedSpeed','preserveHtml','selectedEditorId']);
      const text = cfg.savedText || '';
      const html = cfg.preserveHtml ? (cfg.savedHtml || '') : '';
      const speed = cfg.savedSpeed || 1.0;
      const editorId = cfg.selectedEditorId || null;

      // 1) Try main-world TinyMCE path
      try {
        await new Promise((resolve) => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: (p) => {
              (async () => {
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                let ed = null;
                for (let i = 0; i < 60; i++) {
                  ed = (window.tinymce && (
                    (p.editorId && window.tinymce.get && window.tinymce.get(p.editorId)) ||
                    (window.tinymce.EditorManager && p.editorId && window.tinymce.EditorManager.editors && window.tinymce.EditorManager.editors.find(e => e.id === p.editorId)) ||
                    window.tinymce.activeEditor ||
                    (window.tinymce.EditorManager && window.tinymce.EditorManager.activeEditor)
                  )) || null;
                  if (ed) break;
                  await sleep(50);
                }
                if (!ed) return; // fallback to content script below
                try {
                  ed.focus();
                  if (p.html) {
                    ed.insertContent(p.html);
                    return;
                  }
                  const text = p.text || '';
                  let i = 0;
                  const baseDelay = Math.max(5, 100 / (p.speed || 1));
                  const step = () => {
                    if (i >= text.length) return;
                    const ch = text[i++];
                    if (ch === '\n') ed.insertContent('<br/>'); else ed.insertContent(ch);
                    const delay = baseDelay + Math.random() * (baseDelay/2);
                    setTimeout(step, delay);
                  };
                  step();
                } catch (e) {}
              })();
            },
            args: [{ text, html, speed, editorId }]
          }, () => resolve());
        });
      } catch (e) {}

      // 2) Broadcast to content scripts for generic typing (countdown 0)
      chrome.runtime.sendMessage({
        action: 'broadcast_to_frames',
        tabId: tab.id,
        message: { action: 'start_typing', text, html, speed, editorId, countdown: 0 }
      });
    }

    if (command === 'stop-typing') {
      chrome.runtime.sendMessage({
        action: 'broadcast_to_frames',
        tabId: tab.id,
        message: { action: 'stop_typing' }
      });
    }
  } catch (e) {
    // ignore errors in commands
  }
});

// Check activation status periodically
try {
  chrome.alarms.create('checkActivation', { periodInMinutes: 60 });
  
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkActivation') {
      chrome.storage.local.get(['expiration_date'], (result) => {
        if (result.expiration_date) {
          const expirationDate = new Date(result.expiration_date);
          const now = new Date();
          
          if (now >= expirationDate) {
            // Clear activation data if expired
            chrome.storage.local.remove([
              'activation_key',
              'activation_type',
              'expiration_date',
              'activation_date'
            ]);
            
            // Try to show notification if API is available
            if (chrome.notifications) {
              chrome.notifications.create('expiredNotification', {
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Typing Automator',
                message: 'Your activation has expired. Please renew to continue using all features.'
              });
            }
          }
        }
      });
    }
  });
} catch (e) {
  console.log('Alarms API not available:', e);
}
