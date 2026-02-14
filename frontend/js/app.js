/* eslint-disable no-console */
// app.js - Main application logic

import { api } from './api.js';
import { FloatingWindowManager } from './floating-windows.js';
import { CanvasControls } from './canvas-controls.js';

class JournalApp {
  constructor() {
    this.currentDate = null;
    this.currentDay = null;
    this.windowManager = new FloatingWindowManager('windows-container');
    this.canvasControls = new CanvasControls('windows-container');
    this.goalsEditMode = false;
    this.prompts = [];
    this.currentCategory = 'all';

    this.initializeElements();
    this.attachEventListeners();
    this.checkStatus();
  }

  initializeElements() {
    // Screens
    this.unlockScreen = document.getElementById('unlock-screen');
    this.appScreen = document.getElementById('app-screen');

    // Unlock form
    this.unlockForm = document.getElementById('unlock-form');
    this.passphraseInput = document.getElementById('passphrase');
    this.unlockError = document.getElementById('unlock-error');

    // Date controls
    this.dateSelector = document.getElementById('date-selector');
    this.prevDayBtn = document.getElementById('prev-day');
    this.nextDayBtn = document.getElementById('next-day');
    this.todayBtn = document.getElementById('today');

    // Actions
    this.addPromptBtn = document.getElementById('add-prompt');
    this.addFreeformBtn = document.getElementById('add-freeform');
    this.lockVaultBtn = document.getElementById('lock-vault');

    // Goals
    this.editGoalsBtn = document.getElementById('edit-goals');
    this.goalsDisplay = document.getElementById('goals-display');
    this.goalsEditor = document.getElementById('goals-editor');
    this.saveGoalsBtn = document.getElementById('save-goals');
    this.cancelGoalsBtn = document.getElementById('cancel-goals');
    this.goalsActions = document.querySelector('.goals-actions');

    // Prompts modal
    this.promptsModal = document.getElementById('prompts-modal');
    this.closePromptsBtn = document.getElementById('close-prompts');
    this.promptsFilters = document.querySelector('.prompts-filters');
    this.promptsList = document.getElementById('prompts-list');
  }

  attachEventListeners() {
    // Unlock form
    this.unlockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUnlock();
    });

    // Date navigation
    this.dateSelector.addEventListener('change', () => {
      this.loadDate(this.dateSelector.value);
    });

    this.prevDayBtn.addEventListener('click', () => this.navigateDay(-1));
    this.nextDayBtn.addEventListener('click', () => this.navigateDay(1));
    this.todayBtn.addEventListener('click', () => this.goToToday());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' && e.ctrlKey) {
        this.navigateDay(-1);
      } else if (e.key === 'ArrowRight' && e.ctrlKey) {
        this.navigateDay(1);
      }
    });

    // Window actions
    this.addPromptBtn.addEventListener('click', () => {
      this.showPromptsModal();
    });

    this.addFreeformBtn.addEventListener('click', () => {
      this.windowManager.createWindow('text', 'Freeform Text');
    });

    // Lock vault
    this.lockVaultBtn.addEventListener('click', () => this.handleLock());

    // Prompts modal
    this.closePromptsBtn.addEventListener('click', () => this.hidePromptsModal());
    this.promptsModal.addEventListener('click', (e) => {
      if (e.target === this.promptsModal) {
        this.hidePromptsModal();
      }
    });

    // Goals editing
    this.editGoalsBtn.addEventListener('click', () => this.enterGoalsEditMode());
    this.saveGoalsBtn.addEventListener('click', () => this.saveGoals());
    this.cancelGoalsBtn.addEventListener('click', () => this.exitGoalsEditMode());
  }

  async checkStatus() {
    try {
      const status = await api.getStatus();
      if (status.unlocked) {
        this.showApp();
        this.goToToday();
      } else {
        this.showUnlock();
      }
      // eslint-disable-next-line no-unused-vars
    } catch (err) {
      this.showUnlock();
    }
  }

  async handleUnlock() {
    const passphrase = this.passphraseInput.value;
    this.unlockError.textContent = '';

    try {
      await api.unlock(passphrase);
      this.showApp();
      this.goToToday();
    } catch (err) {
      this.unlockError.textContent = err.message;
    }
  }

  async handleLock() {
    try {
      await api.lock();
      this.showUnlock();
      this.passphraseInput.value = '';
    } catch (err) {
      console.error('Failed to lock:', err);
    }
  }

  showUnlock() {
    this.unlockScreen.classList.remove('hidden');
    this.appScreen.classList.add('hidden');
  }

  showApp() {
    this.unlockScreen.classList.add('hidden');
    this.appScreen.classList.remove('hidden');
  }

  goToToday() {
    const today = new Date().toISOString().split('T')[0];
    this.dateSelector.value = today;
    this.loadDate(today);
  }

  navigateDay(offset) {
    const currentDate = new Date(this.currentDate);
    currentDate.setDate(currentDate.getDate() + offset);
    const newDate = currentDate.toISOString().split('T')[0];
    this.dateSelector.value = newDate;
    this.loadDate(newDate);
  }

  async loadDate(dateString) {
    try {
      this.currentDate = dateString;

      // Get or create day
      this.currentDay = await api.getDay(dateString);

      // Load windows
      await this.windowManager.loadWindows(this.currentDay.id);

      // Load goals
      await this.loadGoals();
    } catch (err) {
      console.error('Failed to load date:', err);
    }
  }

  async loadGoals() {
    try {
      const goals = await api.getGoals(this.currentDay.id);
      this.goalsDisplay.textContent = goals.content || 'No goals set yet.';
      this.goalsEditor.value = goals.content || '';
    } catch (err) {
      console.error('Failed to load goals:', err);
    }
  }

  enterGoalsEditMode() {
    if (this.goalsEditMode) return;

    this.goalsEditMode = true;
    this.goalsDisplay.classList.add('hidden');
    this.goalsEditor.classList.remove('hidden');
    this.goalsActions.classList.remove('hidden');
    this.goalsEditor.focus();
  }

  exitGoalsEditMode() {
    this.goalsEditMode = false;
    this.goalsEditor.classList.add('hidden');
    this.goalsActions.classList.add('hidden');
    this.goalsDisplay.classList.remove('hidden');
  }

  async saveGoals() {
    try {
      const content = this.goalsEditor.value;
      await api.updateGoals(this.currentDay.id, content);
      this.goalsDisplay.textContent = content || 'No goals set yet.';
      this.exitGoalsEditMode();
    } catch (err) {
      console.error('Failed to save goals:', err);
    }
  }

  // Prompts Modal
  async showPromptsModal() {
    this.promptsModal.classList.remove('hidden');
    await this.loadPrompts();
  }

  hidePromptsModal() {
    this.promptsModal.classList.add('hidden');
  }

  async loadPrompts() {
    try {
      // Load prompts and categories
      const [prompts, categories] = await Promise.all([
        api.getPrompts(),
        api.getPromptCategories(),
      ]);

      this.prompts = prompts;

      // Build category filters
      this.promptsFilters.innerHTML =
        '<button class="filter-btn active" data-category="all">All</button>';
      categories.forEach((category) => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.dataset.category = category;
        btn.textContent = category;
        btn.addEventListener('click', () => this.filterPrompts(category));
        this.promptsFilters.appendChild(btn);
      });

      // Add click handler to 'All' button
      this.promptsFilters
        .querySelector('[data-category="all"]')
        .addEventListener('click', () => this.filterPrompts('all'));

      // Display prompts
      this.displayPrompts(this.prompts);
    } catch (err) {
      console.error('Failed to load prompts:', err);
    }
  }

  filterPrompts(category) {
    this.currentCategory = category;

    // Update active filter button
    this.promptsFilters.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });

    // Filter and display prompts
    const filtered =
      category === 'all'
        ? this.prompts
        : this.prompts.filter((p) => p.config.category === category);

    this.displayPrompts(filtered);
  }

  displayPrompts(prompts) {
    if (prompts.length === 0) {
      this.promptsList.innerHTML =
        '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No prompts found.</p>';
      return;
    }

    this.promptsList.innerHTML = '';
    prompts.forEach((prompt) => {
      const item = document.createElement('div');
      item.className = 'prompt-item';
      item.innerHTML = `
        <div class="prompt-item-title">${prompt.title}</div>
        <div class="prompt-item-description">${prompt.description}</div>
        <span class="prompt-item-category">${prompt.config.category}</span>
      `;
      item.addEventListener('click', () => this.usePrompt(prompt));
      this.promptsList.appendChild(item);
    });
  }

  async usePrompt(prompt) {
    try {
      const content = prompt.config.prefill || `${prompt.description}\n\n`;
      await this.windowManager.createWindow('text', prompt.title, content);
      this.hidePromptsModal();
    } catch (err) {
      console.error('Failed to create window from prompt:', err);
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new JournalApp();
});
