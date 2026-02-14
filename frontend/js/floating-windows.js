/* eslint-disable no-console */
// floating-windows.js - Floating window management with interact.js

import { api } from './api.js';

// Access interact from global scope (loaded via script tag)
const interact = window.interact;

export class FloatingWindowManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.windows = new Map();
    this.currentDayId = null;
    this.autoSaveDelay = 1000; // 1 second debounce
    this.saveTimers = new Map();
  }

  setCurrentDay(dayId) {
    this.currentDayId = dayId;
  }

  async loadWindows(dayId) {
    this.setCurrentDay(dayId);

    // Clear existing windows
    this.clearWindows();

    // Fetch windows from backend
    const windows = await api.getWindows(dayId);

    // Create window elements
    for (const windowData of windows) {
      this.createWindowElement(windowData);
    }
  }

  createWindowElement(data) {
    const template = document.getElementById('window-template');
    const windowEl = template.content.cloneNode(true).querySelector('.floating-window');

    windowEl.dataset.windowId = data.id;
    windowEl.querySelector('.window-title').textContent = data.title || 'Untitled';
    windowEl.querySelector('.window-textarea').value = data.content || '';

    // Set position and size
    windowEl.style.left = `${data.position.x}px`;
    windowEl.style.top = `${data.position.y}px`;
    windowEl.style.width = `${data.size.width}px`;
    windowEl.style.height = `${data.size.height}px`;

    // Update pinned state
    if (data.pinned) {
      windowEl.classList.add('pinned');
    }

    this.container.appendChild(windowEl);
    this.windows.set(data.id, { element: windowEl, data });

    // Setup interactions
    this.setupInteractions(windowEl, data.id);
    this.setupEventListeners(windowEl, data.id);

    return windowEl;
  }

  setupInteractions(windowEl, windowId) {
    //const header = windowEl.querySelector('.window-header');

    // Make draggable
    interact(windowEl)
      .draggable({
        allowFrom: '.window-header',
        inertia: false,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: true,
          }),
        ],
        listeners: {
          move: (event) => {
            const target = event.target;
            const x = (parseFloat(target.style.left) || 0) + event.dx;
            const y = (parseFloat(target.style.top) || 0) + event.dy;

            target.style.left = `${x}px`;
            target.style.top = `${y}px`;
          },
          end: (event) => {
            const target = event.target;
            const x = parseFloat(target.style.left) || 0;
            const y = parseFloat(target.style.top) || 0;

            this.saveWindowPosition(windowId, { x, y });
          },
        },
      })
      .resizable({
        edges: { right: '.window-resize-handle', bottom: '.window-resize-handle' },
        listeners: {
          move: (event) => {
            const target = event.target;
            let x = parseFloat(target.style.left) || 0;
            let y = parseFloat(target.style.top) || 0;

            target.style.width = `${event.rect.width}px`;
            target.style.height = `${event.rect.height}px`;

            x += event.deltaRect.left;
            y += event.deltaRect.top;

            target.style.left = `${x}px`;
            target.style.top = `${y}px`;
          },
          end: (event) => {
            const target = event.target;
            const width = parseFloat(target.style.width);
            const height = parseFloat(target.style.height);
            const x = parseFloat(target.style.left) || 0;
            const y = parseFloat(target.style.top) || 0;

            this.saveWindowSize(windowId, { width, height }, { x, y });
          },
        },
        modifiers: [
          interact.modifiers.restrictSize({
            min: { width: 300, height: 200 },
          }),
        ],
      });
  }

  setupEventListeners(windowEl, windowId) {
    const textarea = windowEl.querySelector('.window-textarea');
    const titleEl = windowEl.querySelector('.window-title');
    const closeBtn = windowEl.querySelector('.btn-close');
    const pinBtn = windowEl.querySelector('.btn-pin');

    // Auto-save content on typing
    textarea.addEventListener('input', () => {
      this.scheduleAutoSave(windowId, textarea.value);
    });

    // Auto-save title on edit
    titleEl.addEventListener('blur', () => {
      const title = titleEl.textContent.trim() || 'Untitled';
      titleEl.textContent = title;
      this.saveWindowTitle(windowId, title);
    });

    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleEl.blur();
      }
    });

    // Close button
    closeBtn.addEventListener('click', () => {
      this.deleteWindow(windowId);
    });

    // Pin button
    pinBtn.addEventListener('click', () => {
      const window = this.windows.get(windowId);
      const isPinned = !window.data.pinned;
      window.data.pinned = isPinned;
      windowEl.classList.toggle('pinned', isPinned);
      api.updateWindow(windowId, { pinned: isPinned });
    });

    // Bring to front on click
    windowEl.addEventListener('mousedown', () => {
      this.bringToFront(windowEl);
    });
  }

  scheduleAutoSave(windowId, content) {
    // Clear existing timer
    if (this.saveTimers.has(windowId)) {
      clearTimeout(this.saveTimers.get(windowId));
    }

    // Schedule new save
    const timer = setTimeout(() => {
      this.saveWindowContent(windowId, content);
      this.saveTimers.delete(windowId);
    }, this.autoSaveDelay);

    this.saveTimers.set(windowId, timer);
  }

  async saveWindowContent(windowId, content) {
    try {
      await api.updateWindow(windowId, { content });
    } catch (err) {
      console.error('Failed to save window content:', err);
    }
  }

  async saveWindowTitle(windowId, title) {
    try {
      await api.updateWindow(windowId, { title });
      const window = this.windows.get(windowId);
      if (window) {
        window.data.title = title;
      }
    } catch (err) {
      console.error('Failed to save window title:', err);
    }
  }

  async saveWindowPosition(windowId, position) {
    try {
      await api.updateWindow(windowId, { position });
    } catch (err) {
      console.error('Failed to save window position:', err);
    }
  }

  async saveWindowSize(windowId, size, position) {
    try {
      await api.updateWindow(windowId, { size, position });
    } catch (err) {
      console.error('Failed to save window size:', err);
    }
  }

  bringToFront(windowEl) {
    const allWindows = this.container.querySelectorAll('.floating-window');
    let maxZ = 999;

    allWindows.forEach((w) => {
      const z = parseInt(window.getComputedStyle(w).zIndex) || 999;
      if (z > maxZ) maxZ = z;
    });

    windowEl.style.zIndex = maxZ + 1;
  }

  async createWindow(type, title, content = '') {
    if (!this.currentDayId) {
      throw new Error('No day selected');
    }

    // Calculate position (cascade windows)
    const windowCount = this.windows.size;
    const offset = windowCount * 30;

    const windowData = {
      type,
      title,
      position: { x: 200 + offset, y: 300 + offset },
      size: { width: 500, height: 400 },
      pinned: false,
      content,
    };

    const created = await api.createWindow(this.currentDayId, windowData);
    this.createWindowElement(created);
  }

  async deleteWindow(windowId) {
    try {
      await api.deleteWindow(windowId);

      const window = this.windows.get(windowId);
      if (window) {
        window.element.remove();
        this.windows.delete(windowId);
      }
    } catch (err) {
      console.error('Failed to delete window:', err);
    }
  }

  clearWindows() {
    // Clear all save timers
    this.saveTimers.forEach((timer) => clearTimeout(timer));
    this.saveTimers.clear();

    // Remove all window elements
    this.windows.forEach((window) => {
      window.element.remove();
    });
    this.windows.clear();
  }
}
