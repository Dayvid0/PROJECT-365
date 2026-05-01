// popup.js - Main popup logic
class TypingAutomator {
  constructor() {
    this.isTyping = false;
    this.currentText = '';
    this.keyService = new KeyVerification();
    this.init();
  }

  async init() {
    await this.checkActivation();
    this.setupEventListeners();
    await this.loadSavedSpeed();
    this.updateCharCount();
    this.loadSavedText();
  }


  // No activation/auth required, always show main section
  async checkActivation() {
    document.getElementById('activationSection').style.display = 'none';
    document.getElementById('mainSection').style.display = 'block';
    document.getElementById('statusText').textContent = 'Unlocked';
    document.getElementById('statusBadge').className = 'status-badge active';
    // Setup inject clipboard button for all editors
    const injectBtn = document.getElementById('injectClipboardBtn');
    if (injectBtn) {
      injectBtn.addEventListener('click', async () => {
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (!clipboardText) {
            this.showMessage('Clipboard is empty or unavailable.', 'error');
            return;
          }
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0] || !tabs[0].id) {
              this.showMessage('No active tab found.', 'error');
              return;
            }
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id, allFrames: true },
              func: (text) => {
                // Try TinyMCE first
                if (window.tinymce && tinymce.editors && tinymce.editors.length > 0) {
                  let injected = false;
                  let active = tinymce.activeEditor;
                  if (active && !active.destroyed && active.mode.get && active.mode.get() === 'design') {
                    active.focus();
                    active.insertContent(text);
                    injected = true;
                  } else {
                    for (const ed of tinymce.editors) {
                      try {
                        if (ed && !ed.destroyed && ed.mode.get && ed.mode.get() === 'design') {
                          ed.focus();
                          ed.insertContent(text);
                          injected = true;
                          break;
                        }
                      } catch (e) {}
                    }
                  }
                  if (injected) return;
                }
                // Fallback: inject into focused input/textarea/contenteditable
                const el = document.activeElement;
                if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                  const start = el.selectionStart || 0;
                  const end = el.selectionEnd || 0;
                  const val = el.value;
                  el.value = val.slice(0, start) + text + val.slice(end);
                  el.selectionStart = el.selectionEnd = start + text.length;
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.focus();
                  return;
                }
                if (el && el.isContentEditable) {
                  // Insert at caret
                  const sel = window.getSelection();
                  if (sel && sel.rangeCount > 0) {
                    sel.deleteFromDocument();
                    sel.getRangeAt(0).insertNode(document.createTextNode(text));
                  } else {
                    el.innerText += text;
                  }
                  el.focus();
                  return;
                }
                alert('No supported editor is focused. Click into a text field or editor and try again.');
              },
              args: [clipboardText]
            });
          });
        } catch (err) {
          this.showMessage('Clipboard access denied: ' + (err.message || err), 'error');
        }
      });
    }
    // Add context menu for injection (right-click) for all editors, as a submenu under 'Typing Automator'
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].id) return;
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id, allFrames: true },
        func: () => {
          // TinyMCE context menu
          if (window.tinymce && tinymce.editors && tinymce.editors.length > 0 && tinymce.ui && tinymce.activeEditor) {
            if (!window.__TA_INJECT_MENU_ADDED) {
              tinymce.activeEditor.ui.registry.addMenuItem('injectClipboard', {
                text: 'Inject Clipboard',
                onAction: async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    tinymce.activeEditor.focus();
                    tinymce.activeEditor.insertContent(text);
                  } catch (e) { alert('Clipboard access denied'); }
                }
              });
              tinymce.activeEditor.ui.registry.addContextMenu('typingAutomatorMenu', {
                update: () => ['injectClipboard']
              });
              tinymce.activeEditor.on('contextmenu', function (e) {
                tinymce.activeEditor.ui.showContextMenu('typingAutomatorMenu', e.clientX, e.clientY);
              });
              window.__TA_INJECT_MENU_ADDED = true;
            }
          }
          // Native context menu for input/textarea/contenteditable
          if (!window.__TA_NATIVE_INJECT_MENU_ADDED) {
            document.addEventListener('contextmenu', function(e) {
              const el = e.target;
              if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
                // Remove any existing menu
                let menu = document.getElementById('__ta_inject_menu');
                if (menu) menu.remove();
                // Create main Typing Automator menu
                menu = document.createElement('div');
                menu.id = '__ta_inject_menu';
                menu.style.position = 'fixed';
                menu.style.zIndex = 99999;
                menu.style.left = e.clientX + 'px';
                menu.style.top = e.clientY + 'px';
                menu.style.background = '#fff';
                menu.style.border = '1px solid #ccc';
                menu.style.padding = '0';
                menu.style.cursor = 'default';
                menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                // Main menu title
                const main = document.createElement('div');
                main.textContent = 'Typing Automator';
                main.style.fontWeight = 'bold';
                main.style.padding = '6px 16px 6px 12px';
                main.style.background = '#f3f3f3';
                menu.appendChild(main);
                // Submenu: Inject Clipboard
                const inject = document.createElement('div');
                inject.textContent = 'Inject Clipboard';
                inject.style.padding = '6px 24px 6px 32px';
                inject.style.cursor = 'pointer';
                inject.onmousedown = async (evt) => {
                  evt.preventDefault();
                  try {
                    const text = await navigator.clipboard.readText();
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                      const start = el.selectionStart || 0;
                      const end = el.selectionEnd || 0;
                      const val = el.value;
                      el.value = val.slice(0, start) + text + val.slice(end);
                      el.selectionStart = el.selectionEnd = start + text.length;
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                      el.focus();
                    } else if (el.isContentEditable) {
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0) {
                        sel.deleteFromDocument();
                        sel.getRangeAt(0).insertNode(document.createTextNode(text));
                      } else {
                        el.innerText += text;
                      }
                      el.focus();
                    }
                  } catch (e) { alert('Clipboard access denied'); }
                  menu.remove();
                };
                menu.appendChild(inject);
                document.body.appendChild(menu);
                // Remove menu on click elsewhere
                setTimeout(() => {
                  document.addEventListener('mousedown', function handler() {
                    menu.remove();
                    document.removeEventListener('mousedown', handler);
                  });
                }, 0);
                e.preventDefault();
              }
            });
            window.__TA_NATIVE_INJECT_MENU_ADDED = true;
          }
        }
      });
    });
  }


  showTrialLimitations() {}

  setupEventListeners() {
    // Speed slider
    const speedSlider = document.getElementById('speedSlider');
    speedSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById('speedValue').textContent = value.toFixed(1);
      document.getElementById('speedLabel').textContent = this.getSpeedLabel(value);
      chrome.storage.local.set({ savedSpeed: value });
    });

    // Text input
    const textInput = document.getElementById('textInput');
    textInput.addEventListener('input', () => {
      this.updateCharCount();
      this.saveText();
    });

    // Import DOCX button
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    // File input
    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.handleFileImport(e.target.files[0]);
    });

    // Preserve HTML toggle
    const preserve = document.getElementById('preserveHtml');
    if (preserve) {
      preserve.addEventListener('change', async (e) => {
        await chrome.storage.local.set({ preserveHtml: !!e.target.checked });
      });
    }

    // Clear button
    document.getElementById('clearBtn').addEventListener('click', () => {
      textInput.value = '';
      this.updateCharCount();
      this.saveText();
    });

    // Format/Clean button
    document.getElementById('formatBtn').addEventListener('click', () => {
      textInput.value = this.cleanText(textInput.value);
      this.updateCharCount();
      this.saveText();
    });

    // Start button
    document.getElementById('startBtn').addEventListener('click', () => {
      this.startTyping();
    });

    // Stop button
    document.getElementById('stopBtn').addEventListener('click', () => {
      this.stopTyping();
    });

    // Activation
    document.getElementById('copyMachineCode').addEventListener('click', async () => {
      const machineCode = document.getElementById('machineCode').textContent;
      await navigator.clipboard.writeText(machineCode);
      this.showMessage('Machine code copied!', 'success');
    });

    document.getElementById('activateBtn').addEventListener('click', () => {
      this.activateKey();
    });

    const openWhatsApp = async () => {
      const machineCode = document.getElementById('machineCode').textContent.trim();
      const text = encodeURIComponent(`I need an activation key for Typing Automator Chrome Extension\nMachine Code: ${machineCode}`);
      chrome.tabs.create({ url: `https://wa.me/256764894987?text=${text}` });
    };
    const openEmail = async () => {
      const machineCode = document.getElementById('machineCode').textContent.trim();
      const subject = encodeURIComponent('Activation key request - Typing Automator');
      const body = encodeURIComponent(`Hello,\n\nI need an activation key for Typing Automator Chrome Extension.\nMachine Code: ${machineCode}\n\nDuration: 3 days / 1 month / 1 year (choose one)\n\nThank you.`);
      chrome.tabs.create({ url: `mailto:lutherlear3@gmail.com?subject=${subject}&body=${body}` });
    };
    const waBtn = document.getElementById('getKeyWhatsApp');
    const emailBtn = document.getElementById('getKeyEmail');
    if (waBtn) waBtn.addEventListener('click', openWhatsApp);
    if (emailBtn) emailBtn.addEventListener('click', openEmail);

    // Admin link (long press simulation with click counter)
    let adminClicks = 0;
    let adminClickTimer;
    document.getElementById('adminLink').addEventListener('click', (e) => {
      e.preventDefault();
      adminClicks++;
      
      if (adminClicks === 5) {
        this.showAdminDialog();
        adminClicks = 0;
      }
      
      clearTimeout(adminClickTimer);
      adminClickTimer = setTimeout(() => {
        adminClicks = 0;
      }, 2000);
    });
  }

  async handleFileImport(file) {
    if (!file || !file.name.endsWith('.docx')) {
      this.showMessage('Please select a valid DOCX file', 'error');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Extract both raw text and HTML
      const textResult = await mammoth.extractRawText({ arrayBuffer });
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });

      const cleanedText = this.cleanText(textResult.value);
      document.getElementById('textInput').value = cleanedText;
      this.updateCharCount();
      this.saveText();

      // Save HTML for optional formatting insert
      this.lastImportedHtml = htmlResult.value || '';
      this.showMessage('Document imported successfully', 'success');
    } catch (error) {
      console.error('Error importing DOCX:', error);
      this.showMessage('Failed to import document', 'error');
    }
  }

  cleanText(text) {
    if (!text) return '';
    
    return text
      // Remove zero-width spaces
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      // Replace various spaces with standard space
      .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      // Replace various dashes with standard hyphen
      .replace(/[\u2011\u2012-\u2015\u2212]/g, '-')
      // Replace smart quotes
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      // Replace bullets
      .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '*')
      // Replace ellipsis
      .replace(/[\u2026]/g, '...')
      // Normalize line endings
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      // Collapse multiple spaces
      .replace(/ +/g, ' ')
      // Collapse multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async startTyping() {
    const text = document.getElementById('textInput').value;
    if (!text) {
      this.showMessage('Please enter some text first', 'error');
      return;
    }

    const isActivated = await this.keyService.isActivated();
    if (!isActivated && text.length > 100) {
      this.showMessage('Trial mode: Text limited to 100 characters. Please activate for full access.', 'error');
      return;
    }

    this.isTyping = true;
    this.currentText = text;
    
    // Update UI
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    document.getElementById('textInput').disabled = true;
    
    const speed = parseFloat(document.getElementById('speedSlider').value);
    
    // First check if we can access the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) {
        this.stopTyping();
        this.showMessage('Error: No active tab found. Please try again.', 'error');
        return;
      }
      
      const tab = tabs[0];
      
      // Skip chrome:// and other restricted URLs
      if (tab.url && (tab.url.startsWith('chrome://') || 
                      tab.url.startsWith('chrome-extension://') ||
                      tab.url.startsWith('edge://') ||
                      tab.url.startsWith('about:'))) {
        this.stopTyping();
        this.showMessage('Cannot run on Chrome system pages. Please navigate to a website.', 'error');
        return;
      }
      
      try {
        // Ensure content script is present in all frames (harmless if already injected via manifest)
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content.js']
        });

        // Query TinyMCE editors (ids) from MAIN world for picker
        const editors = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: () => {
            try {
              if (!window.tinymce) return [];
              const list = (window.tinymce.EditorManager && window.tinymce.EditorManager.editors) || [];
              return list.map(e => ({ id: e.id, docTitle: document.title }));
            } catch (e) { return []; }
          }
        });
        const edList = (editors && editors[0] && editors[0].result) || [];
        // Populate picker if any
        const picker = document.getElementById('editorPicker');
        const select = document.getElementById('editorSelect');
        if (edList.length > 0 && picker && select) {
          picker.style.display = 'block';
          select.innerHTML = '';
          const opt0 = document.createElement('option');
          opt0.value = '';
          opt0.textContent = 'Auto-detect active editor';
          select.appendChild(opt0);
          edList.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = e.id;
            select.appendChild(opt);
          });
          select.addEventListener('change', async () => {
            await chrome.storage.local.set({ selectedEditorId: select.value || null });
          });
        }

        // Small delay to ensure content script is ready
        await new Promise(resolve => setTimeout(resolve, 200));

        // Build payload
        const preserveHtml = !!document.getElementById('preserveHtml')?.checked;
        const selectedEditorId = document.getElementById('editorSelect')?.value || null;
        const htmlToSend = preserveHtml ? (this.lastImportedHtml || '') : '';
        await chrome.storage.local.set({ preserveHtml, savedHtml: htmlToSend, selectedEditorId });

        // Broadcast to all frames so the focused one handles typing
        chrome.runtime.sendMessage({
          action: 'broadcast_to_frames',
          tabId: tab.id,
          message: {
            action: 'start_typing',
            text: this.currentText,
            html: htmlToSend,
            editorId: selectedEditorId || null,
            speed: speed,
            countdown: 4
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Broadcast error:', chrome.runtime.lastError);
            this.stopTyping();
            this.showMessage('Error: Could not initialize typing. Please refresh the page.', 'error');
            return;
          }
          // Show success message and close popup
          this.showMessage('Typing will start in 4 seconds. Place your cursor where you want.', 'success');
          setTimeout(() => window.close(), 2000);
        });
      } catch (error) {
        console.error('Script injection/broadcast error:', error);
        this.stopTyping();
        this.showMessage('Error: Could not initialize typing. Please refresh the page.', 'error');
      }
    });
  }

  stopTyping() {
    this.isTyping = false;
    
    // Update UI
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('textInput').disabled = false;
    
    // Broadcast stop to all frames
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return;
      chrome.runtime.sendMessage({
        action: 'broadcast_to_frames',
        tabId: tabs[0].id,
        message: { action: 'stop_typing' }
      });
    });
  }

  updateCharCount() {
    const text = document.getElementById('textInput').value;
    document.getElementById('charCount').textContent = text.length;
  }

  saveText() {
    const text = document.getElementById('textInput').value;
    chrome.storage.local.set({ savedText: text });
  }

  async loadSavedText() {
    const result = await chrome.storage.local.get(['savedText','preserveHtml']);
    if (result.savedText) {
      document.getElementById('textInput').value = result.savedText;
      this.updateCharCount();
    }
    const preserve = document.getElementById('preserveHtml');
    if (preserve && typeof result.preserveHtml === 'boolean') {
      preserve.checked = result.preserveHtml;
    }
  }

  async loadSavedSpeed() {
    const result = await chrome.storage.local.get('savedSpeed');
    const speed = parseFloat(result.savedSpeed);
    const slider = document.getElementById('speedSlider');
    if (!isNaN(speed) && slider) {
      slider.value = speed;
      document.getElementById('speedValue').textContent = speed.toFixed(1);
      document.getElementById('speedLabel').textContent = this.getSpeedLabel(speed);
    }
  }

  getSpeedLabel(speed) {
    if (speed <= 0.5) return 'Very Slow';
    if (speed <= 1.0) return 'Normal';
    if (speed <= 2.0) return 'Fast';
    if (speed <= 4.0) return 'Very Fast';
    if (speed <= 7.0) return 'Ultra Fast';
    return 'Maximum';
  }

  showMessage(message, type) {
    const msgDiv = document.getElementById('activationMessage');
    msgDiv.textContent = message;
    msgDiv.className = `activation-message ${type}`;
    
    setTimeout(() => {
      msgDiv.className = 'activation-message';
      msgDiv.textContent = '';
    }, 3000);
  }

  async activateKey() {
    const key = document.getElementById('activationKey').value.trim();
    if (!key) {
      this.showMessage('Please enter an activation key', 'error');
      return;
    }

    const keyType = await this.keyService.verifyKey(key);
    if (keyType) {
      await this.keyService.activateKey(key, keyType);
      this.showMessage('Activation successful!', 'success');
      setTimeout(() => {
        location.reload();
      }, 1500);
    } else {
      this.showMessage('Invalid activation key', 'error');
    }
  }

  async showAdminDialog() {
    const password = prompt('Enter admin password:');
    if (password === 'Katumb@@2222') {
      if (confirm('Reset activation? This will expire the current subscription.')) {
        await this.keyService.clearActivationData();
        alert('Activation has been reset');
        location.reload();
      }
    } else if (password) {
      alert('Invalid password');
    }
  }
}

// Key Verification Service

// KeyVerification stub for compatibility (no-op)
class KeyVerification {
  async getMachineCode() { return 'UNLOCKED'; }
  async getCurrentKeyVersion() { return 0; }
  async updateKeyVersion() {}
  async verifyKey() { return true; }
  async activateKey() {}
  async isActivated() { return true; }
  async getRemainingDays() { return 9999; }
  async clearActivationData() {}
  async createMachineHash() { return 'UNLOCKED'; }
  async generateChecksum() { return 'UNLOCKED'; }
  async sha256() { return 'UNLOCKED'; }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new TypingAutomator();
});
