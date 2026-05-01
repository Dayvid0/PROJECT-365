// content.js - Handles typing on the webpage
if (window.__TA_CONTENT_SCRIPT_LOADED) {
  console.debug('Typing Automator content script already loaded');
} else {
  window.__TA_CONTENT_SCRIPT_LOADED = true;
class TypingEngine {
  constructor() {
    this.isTyping = false;
    this.stopRequested = false;
    this.currentText = '';
    this.currentHTML = '';
    this.currentIndex = 0;
    this.speed = 1.0;
    this.targetElement = null;
    this.currentEditorId = null;
    this.tinyBridgeActive = false;
    this.tinyBridgeHandlersBound = false;
    this.setupMessageListener();
    this.setupClickListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'start_typing':
          // Gate so only the frame that should type handles the request
          if (this.shouldHandleStart()) {
            this.startTypingWithCountdown(request.text, request.speed, request.countdown || 4, request.html || '', request.editorId || null);
            sendResponse({ status: 'started' });
          } else {
            sendResponse({ status: 'ignored' });
          }
          break;
        case 'stop_typing':
          this.stopTyping();
          sendResponse({ status: 'stopped' });
          break;
        case 'get_status':
          sendResponse({ isTyping: this.isTyping });
          break;
      }
      return true;
    });
  }

  setupClickListener() {
    // Allow ESC to stop typing universally
    document.addEventListener('keydown', (e) => {
      if (this.isTyping && (e.key === 'Escape')) {
        this.stopTyping();
      }
    }, true);
    document.addEventListener('click', (e) => {
      if (this.isTyping && !this.stopRequested) {
        const target = e.target;
        if (this.isEditableElement(target)) {
          this.targetElement = target;
          this.typeIntoElement();
        }
      }
    });

    // Also listen for focus events
    document.addEventListener('focus', (e) => {
      if (this.isTyping && !this.stopRequested) {
        const target = e.target;
        if (this.isEditableElement(target)) {
          this.targetElement = target;
          this.typeIntoElement();
        }
      }
    }, true);
  }

  isEditableElement(element) {
    if (!element) return false;
    
    // Check if it's an input or textarea
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      return !element.disabled && !element.readOnly;
    }
    
    // Check if it's a contenteditable element
    if (element.isContentEditable || element.contentEditable === 'true') {
      return true;
    }
    
    // Check for CodeMirror, Monaco, and other code editors
    if (element.classList.contains('CodeMirror') || 
        element.classList.contains('monaco-editor') ||
        element.classList.contains('ace_editor')) {
      return true;
    }
    
    // Check for Google Docs canvas (special handling needed)
    if (element.classList.contains('kix-page') || 
        element.classList.contains('docs-texteventtarget-iframe') ||
        element.classList.contains('docs-texteventtarget')) {
      return true;
    }
    
    // Check if element has role="textbox"
    if (element.getAttribute('role') === 'textbox') {
      return true;
    }
    
    return false;
  }

  isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && 
           rect.top < window.innerHeight && rect.bottom > 0;
  }

  shouldHandleStart() {
    try {
      // Always handle in top window on Google Docs (we will target its typing iframe internally)
      if (this.isGoogleDocs() && window.self === window.top) {
        return true;
      }
      // If we are inside an iframe, only the focused frame should handle it
      if (window.self !== window.top) {
        return document.hasFocus();
      }
      // In non-Docs top window: only handle if the active element is editable (not an iframe)
      const ae = document.activeElement;
      if (!ae) return false;
      if (ae.tagName === 'IFRAME' || ae.tagName === 'WEBVIEW') return false;
      return this.isEditableElement(ae);
    } catch (e) {
      return true; // fallback: don't block
    }
  }

  async startTypingWithCountdown(text, speed, countdown, html, editorId) {
    this.currentText = text || '';
    this.currentHTML = html || '';
    this.currentEditorId = editorId || null;
    this.speed = speed || 1.0;
    this.currentIndex = 0;
    this.stopRequested = false;

    // If this frame shouldn't handle typing, ignore early
    if (!this.shouldHandleStart()) {
      return;
    }

    if ((countdown || 0) > 0) {
      // Show countdown indicator
      this.showCountdownIndicator(countdown);
      // Wait for countdown
      for (let i = countdown; i > 0; i--) {
        if (this.stopRequested) return;
        this.updateCountdown(i);
        await this.sleep(1000);
      }
      if (this.stopRequested) return;
      this.hideCountdownIndicator();
    }

    // Start typing now
    this.isTyping = true;
    this.showTypingIndicator();
    
    // If Google Docs, start typing using document-level events
    if (this.isGoogleDocs()) {
      // If HTML provided, convert to plain text preserving line breaks for Docs
      if (this.currentHTML) {
        this.currentText = this.htmlToPlainText(this.currentHTML);
        this.currentHTML = '';
      }
      this.targetElement = document.body;
      this.typeIntoElement();
      return;
    }

    // If TinyMCE iframe present, prefer page-bridge API, then fallback
    const tinyDoc = this.getTinyMCEDocument();
    if (tinyDoc && tinyDoc.body) {
      // Try page bridge first (robust for TinyMCE)
      const bridged = await this.tryTinyMCEBridge();
      if (bridged) {
        return; // bridge owns typing/completion
      }

      // Fallback: direct DOM typing
      this.targetElement = tinyDoc.body;
      if (this.currentHTML) {
        // Insert HTML at once if supported
        const ok = this.tryInsertHTML(tinyDoc, this.currentHTML);
        if (ok) {
          this.stopTyping();
          this.showCompletionMessage();
          return;
        } else {
          // Fallback to plain text typing
          this.currentText = this.htmlToPlainText(this.currentHTML);
          this.currentHTML = '';
        }
      }
      this.typeIntoElement();
      return;
    }

    // Automatically start typing at the currently focused element
    // or wait for user to click on an input
    const activeElement = document.activeElement;
    if (this.isEditableElement(activeElement)) {
      // If we have HTML and the target is contenteditable, attempt to insert HTML directly
      if (this.currentHTML && (activeElement.isContentEditable || activeElement.contentEditable === 'true')) {
        const ok = this.tryInsertHTML(document, this.currentHTML);
        if (ok) {
          this.stopTyping();
          this.showCompletionMessage();
          return;
        } else {
          this.currentText = this.htmlToPlainText(this.currentHTML);
          this.currentHTML = '';
        }
      }
      this.targetElement = activeElement;
      this.typeIntoElement();
    } else {
      // Try to find and focus on any visible text input/textarea
      const inputs = document.querySelectorAll('input[type="text"]:not([disabled]):not([readonly]), input[type="search"]:not([disabled]):not([readonly]), input[type="email"]:not([disabled]):not([readonly]), input:not([type]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), [contenteditable="true"]');
      
      for (let input of inputs) {
        if (this.isElementVisible(input)) {
          input.focus();
          this.targetElement = input;
          await this.sleep(100); // Small delay to ensure focus
          this.typeIntoElement();
          break;
        }
      }
    }
  }

  startTyping(text, speed) {
    this.currentText = text;
    this.speed = speed || 1.0;
    this.currentIndex = 0;
    this.isTyping = true;
    this.stopRequested = false;
    
    // Show visual indicator
    this.showTypingIndicator();
  }

  stopTyping() {
    this.stopRequested = true;
    this.isTyping = false;
    // Tell TinyMCE bridge to stop if active
    try { if (this.tinyBridgeActive) window.postMessage({ __TA_TINYMCE_CMD: true, cmd: 'STOP' }, '*'); } catch (e) {}
    this.hideTypingIndicator();
    this.hideCountdownIndicator();
  }

  async typeIntoElement() {
    if (!this.targetElement || this.stopRequested) return;
    
    // Make sure element is focused
    this.targetElement.focus();
    
    // Clear existing text if needed (optional - remove if you want to append)
    // if (this.currentIndex === 0) {
    //   this.clearElement(this.targetElement);
    // }
    
    // Type character by character
    while (this.currentIndex < this.currentText.length && !this.stopRequested) {
      const char = this.currentText[this.currentIndex];
      
      // Type the character
      this.typeCharacter(this.targetElement, char);
      this.currentIndex++;
      
      // Update progress in indicator
      this.updateProgress();
      
      // Calculate delay based on speed
      const baseDelay = 100 / this.speed;
      const variation = Math.random() * (baseDelay / 2);
      const delay = baseDelay + variation;
      
      // Wait before next character
      await this.sleep(delay);
      
      // For Google Docs and similar, we don't check focus
      if (!this.isGoogleDocs() && !this.isSpecialEditor(this.targetElement)) {
        // Check if element is still focused
        if (document.activeElement !== this.targetElement) {
          // Try to refocus
          this.targetElement.focus();
          // If still not focused, wait for user to click
          if (document.activeElement !== this.targetElement) {
            break;
          }
        }
      }
    }
    
    // Finished typing or stopped
    if (this.currentIndex >= this.currentText.length) {
      this.stopTyping();
      this.showCompletionMessage();
    }
  }

  clearElement(element) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value = '';
    } else if (element.contentEditable === 'true') {
      element.textContent = '';
    }
  }

  typeCharacter(element, char) {
    // Special handling for Google Docs
    if (this.isGoogleDocs()) {
      this.typeInGoogleDocs(char);
      return;
    }

    // Special handling for TinyMCE (iframe editor)
    const tinyDoc = this.getTinyMCEDocument();
    if (tinyDoc && tinyDoc.body) {
      this.typeInTinyMCE(tinyDoc, char);
      return;
    }
    
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      // For input/textarea elements
      const start = element.selectionStart || element.value.length;
      const end = element.selectionEnd || element.value.length;
      const value = element.value;
      
      element.value = value.substring(0, start) + char + value.substring(end);
      element.selectionStart = element.selectionEnd = start + 1;
      
      // Dispatch multiple events to ensure compatibility
      element.dispatchEvent(new InputEvent('beforeinput', { data: char, inputType: 'insertText', bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    } else if (element.contentEditable === 'true' || element.getAttribute('role') === 'textbox') {
      // For contenteditable elements
      const selection = window.getSelection();
      
      // Make sure we have a valid selection
      if (selection.rangeCount === 0) {
        // Create a new range at the end of the element
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.addRange(range);
      }
      
      const range = selection.getRangeAt(0);
      
      // Handle special characters
      if (char === '\n') {
        // Insert line break
        const br = document.createElement('br');
        range.insertNode(br);
        range.setStartAfter(br);
        range.setEndAfter(br);
      } else {
        // Insert regular character
        const textNode = document.createTextNode(char);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
      }
      
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Dispatch input events
      element.dispatchEvent(new InputEvent('beforeinput', { data: char, inputType: 'insertText', bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));
    } else {
      // Try to use keyboard events as fallback
      this.simulateKeyPress(element, char);
    }
  }

  isGoogleDocs() {
    return window.location.hostname.includes('docs.google.com');
  }

  // TinyMCE helpers
  getTinyMCEDocument() {
    try {
      const iframe = document.querySelector(
        'iframe.tox-edit-area__iframe, '
        + 'iframe[id*="tinymce"], '
        + 'iframe[title*="Rich Text Area"], '
        + 'iframe[srcdoc*="tinymce"], '
        + '#online-answersheet_ifr, '
        + 'iframe[id$="_ifr"], '
        + 'iframe[id^="mce_"], '
        + 'iframe[class*="mce-"]'
      );
      if (iframe && iframe.contentDocument) return iframe.contentDocument;
    } catch (e) {}
    return null;
  }

  typeInTinyMCE(doc, char) {
    try {
      if (doc && doc.defaultView) doc.defaultView.focus();
      if (doc && doc.body) doc.body.focus();
      if (char === '\n' || char === '\r') {
        doc.execCommand && doc.execCommand('insertParagraph', false);
      } else {
        // Prefer insertText for plain typing
        if (!doc.execCommand || doc.execCommand('insertText', false, char) === false) {
          // Fallback events
          const target = doc.activeElement || doc.body;
          if (!target) return;
          const beforeInput = new InputEvent('beforeinput', { data: char, inputType: 'insertText', bubbles: true, cancelable: true });
          const inputEv = new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true, cancelable: true });
          target.dispatchEvent(beforeInput);
          target.dispatchEvent(inputEv);
        }
      }
    } catch (e) {}
  }

  tryInsertHTML(doc, html) {
    try {
      if (!doc || !html) return false;
      if (doc && doc.defaultView) doc.defaultView.focus();
      if (doc && doc.body) doc.body.focus();
      if (doc.execCommand && doc.execCommand('insertHTML', false, html) !== false) {
        return true;
      }
      // Fallback: set selection and insert via range
      const sel = doc.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const container = doc.createElement('div');
        container.innerHTML = html;
        const frag = doc.createDocumentFragment();
        while (container.firstChild) frag.appendChild(container.firstChild);
        range.insertNode(frag);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
      }
    } catch (e) {}
    return false;
  }

  htmlToPlainText(html) {
    try {
      const div = document.createElement('div');
      div.innerHTML = html;
      // Convert <br> and <p> to newlines
      div.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
      const paragraphs = Array.from(div.querySelectorAll('p'));
      paragraphs.forEach((p, i) => {
        const text = p.textContent || '';
        const repl = (i < paragraphs.length - 1) ? `${text}\n\n` : text;
        const tn = document.createTextNode(repl);
        p.replaceWith(tn);
      });
      const txt = div.textContent || '';
      return txt;
    } catch (e) {
      return html;
    }
  }

  // Inject a page-world bridge to control TinyMCE via its public API
  bindTinyMCEBridgeHandlers() {
    if (this.tinyBridgeHandlersBound) return;
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (d && d.__TA_TINYMCE_DONE) {
        this.stopTyping();
        if (d.ok) this.showCompletionMessage();
      }
    });
    this.tinyBridgeHandlersBound = true;
  }

  async tryTinyMCEBridge() {
    try {
      this.bindTinyMCEBridgeHandlers();
      await this.sleep(50);
      // Ask background to inject and run TinyMCE typing in MAIN world
      const payload = { text: this.currentText, html: this.currentHTML, speed: this.speed, editorId: this.currentEditorId };
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'tinymce_main_type', payload }, () => {
          // ignore lastError; rely on DONE message
          resolve();
        });
      });
      // Let the main-world runner handle typing and DONE notification
      return true;
    } catch (e) {
      return false;
    }
  }

  typeInGoogleDocs(char) {
    // Google Docs uses a hidden text event target iframe; try to type into it.
    const keyCode = char.charCodeAt(0);

    const textTargetIframe = document.querySelector('iframe.docs-texteventtarget-iframe');
    const editorIframe = document.querySelector('iframe.kix-appview-editor') || document.querySelector('iframe.docs-texteventtarget-iframe');

    const withDoc = (doc) => {
      try {
        // Focus the typing surface
        if (doc && doc.defaultView) doc.defaultView.focus();
        if (doc && doc.body) doc.body.focus();

        if (char === '\n' || char === '\r') {
          doc.execCommand && doc.execCommand('insertParagraph', false);
        } else {
          if (!doc.execCommand || doc.execCommand('insertText', false, char) === false) {
            // Dispatch events as fallback on activeElement or body
            const target = doc.activeElement || doc.body;
            if (!target) return;
            const beforeInput = new InputEvent('beforeinput', { data: char, inputType: 'insertText', bubbles: true, cancelable: true });
            const inputEv = new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true, cancelable: true });
            const keydown = new KeyboardEvent('keydown', { key: char, keyCode: keyCode, which: keyCode, bubbles: true, cancelable: true });
            const keypress = new KeyboardEvent('keypress', { key: char, keyCode: keyCode, which: keyCode, charCode: keyCode, bubbles: true, cancelable: true });
            const keyup = new KeyboardEvent('keyup', { key: char, keyCode: keyCode, which: keyCode, bubbles: true, cancelable: true });
            target.dispatchEvent(keydown);
            target.dispatchEvent(keypress);
            target.dispatchEvent(beforeInput);
            target.dispatchEvent(inputEv);
            // Deprecated but sometimes used
            const textEvent = doc.createEvent && doc.createEvent('TextEvent');
            if (textEvent && textEvent.initTextEvent) {
              textEvent.initTextEvent('textInput', true, true, window, char, 0, 'en-US');
              target.dispatchEvent(textEvent);
            }
            target.dispatchEvent(keyup);
          }
        }
      } catch (e) {
        // swallow and continue
      }
    };

    if (textTargetIframe && textTargetIframe.contentDocument) {
      withDoc(textTargetIframe.contentDocument);
      return;
    }
    if (editorIframe && editorIframe.contentDocument) {
      withDoc(editorIframe.contentDocument);
      return;
    }

    // Last resort: try on top document (may not work on Docs)
    try {
      if (char === '\n' || char === '\r') {
        document.execCommand('insertParagraph', false);
      } else {
        document.execCommand('insertText', false, char);
      }
    } catch (e) {
      // No-op
    }
  }

  simulateKeyPress(element, char) {
    const keyCode = char.charCodeAt(0);
    
    // Create more realistic keyboard events
    const keydownEvent = new KeyboardEvent('keydown', {
      key: char,
      code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
      keyCode: keyCode,
      which: keyCode,
      charCode: 0,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    
    const keypressEvent = new KeyboardEvent('keypress', {
      key: char,
      code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
      keyCode: keyCode,
      which: keyCode,
      charCode: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    
    const beforeInputEvent = new InputEvent('beforeinput', {
      data: char,
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
      composed: true
    });

    const inputEvent = new InputEvent('input', {
      data: char,
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
      composed: true
    });
    
    const keyupEvent = new KeyboardEvent('keyup', {
      key: char,
      code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
      keyCode: keyCode,
      which: keyCode,
      charCode: 0,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    
    // Try dispatching to both element and document
    element.dispatchEvent(keydownEvent);
    document.dispatchEvent(keypressEvent);
    element.dispatchEvent(beforeInputEvent);
    element.dispatchEvent(inputEvent);
    element.dispatchEvent(keyupEvent);
    
    // Also try the deprecated textInput event which some sites still use
    const textEvent = document.createEvent('TextEvent');
    if (textEvent.initTextEvent) {
      textEvent.initTextEvent('textInput', true, true, window, char, 0, 'en-US');
      element.dispatchEvent(textEvent);
    }
  }

  isSpecialEditor(element) {
    return element.classList.contains('CodeMirror') ||
           element.classList.contains('monaco-editor') ||
           element.classList.contains('ace_editor') ||
           element.classList.contains('kix-page');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showTypingIndicator() {
    // Remove existing indicators
    this.hideTypingIndicator();
    this.hideCountdownIndicator();
    
    // Create indicator element
    const indicator = document.createElement('div');
    indicator.id = 'typing-automator-indicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        "></div>
        <span id="typing-status">Typing in progress...</span>
        <span id="typing-progress" style="
          background: rgba(255,255,255,0.2);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
        ">0%</span>
        <button id="typing-stop-btn" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          margin-left: 10px;
        ">Stop</button>
      </div>
      <style>
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        #typing-stop-btn:hover {
          background: rgba(255,255,255,0.3) !important;
        }
      </style>
    `;
    
    document.body.appendChild(indicator);
    
    // Add click handler to stop button
    const stopBtn = document.getElementById('typing-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.stopTyping();
      });
    }
  }

  updateProgress() {
    const progressEl = document.getElementById('typing-progress');
    if (progressEl && this.currentText) {
      const percentage = Math.round((this.currentIndex / this.currentText.length) * 100);
      progressEl.textContent = `${percentage}%`;
    }
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('typing-automator-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  showCountdownIndicator(seconds) {
    // Remove any existing indicators
    this.hideTypingIndicator();
    this.hideCountdownIndicator();
    
    const indicator = document.createElement('div');
    indicator.id = 'typing-automator-countdown';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
        color: white;
        padding: 40px;
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center;
        z-index: 999999;
        animation: bounceIn 0.5s ease;
      ">
        <h2 style="margin: 0 0 20px 0; font-size: 24px;">Get Ready!</h2>
        <div id="countdown-number" style="
          font-size: 72px;
          font-weight: bold;
          margin: 20px 0;
          text-shadow: 0 2px 10px rgba(0,0,0,0.2);
        ">${seconds}</div>
        <p style="margin: 20px 0 0 0; font-size: 16px;">Click on any text field after countdown</p>
        <button id="countdown-stop-btn" style="
          background: rgba(255,255,255,0.2);
          border: 2px solid white;
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          margin-top: 20px;
          font-weight: 600;
        ">Cancel</button>
      </div>
      <style>
        @keyframes bounceIn {
          0% {
            transform: translate(-50%, -50%) scale(0.3);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.05);
          }
          70% {
            transform: translate(-50%, -50%) scale(0.9);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
        #countdown-stop-btn:hover {
          background: rgba(255,255,255,0.3) !important;
        }
      </style>
    `;
    
    document.body.appendChild(indicator);
    
    // Add cancel button handler
    document.getElementById('countdown-stop-btn').addEventListener('click', () => {
      this.stopTyping();
      this.hideCountdownIndicator();
    });
  }

  updateCountdown(seconds) {
    const countdownEl = document.getElementById('countdown-number');
    if (countdownEl) {
      countdownEl.textContent = seconds;
      // Add pulse animation
      countdownEl.style.animation = 'none';
      setTimeout(() => {
        countdownEl.style.animation = 'pulse 0.5s ease';
      }, 10);
    }
  }

  hideCountdownIndicator() {
    const indicator = document.getElementById('typing-automator-countdown');
    if (indicator) {
      indicator.remove();
    }
  }

  showCompletionMessage() {
    const message = document.createElement('div');
    message.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 999999;
        animation: slideIn 0.3s ease;
      ">
        ✓ Typing completed successfully!
      </div>
    `;
    
    document.body.appendChild(message);
    
    // Remove after 3 seconds
    setTimeout(() => {
      message.remove();
    }, 3000);
  }
}

// Initialize the typing engine
const typingEngine = new TypingEngine();

// Log that content script is loaded
console.log('Typing Automator content script loaded');
}
