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
    this.existingDays = []; // List of all days in database
    this.currentEditableDay = null; // Most recent day (editable)
    this.isViewingCurrentEditableDay = true;

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
    this.journalNameInput = document.getElementById('journal-name');
    this.passphraseInput = document.getElementById('passphrase');
    this.unlockError = document.getElementById('unlock-error');
    this.createNewBtn = document.getElementById('create-new-btn');

    // Create journal modal
    this.createJournalModal = document.getElementById('create-journal-modal');
    this.closeCreateJournalBtn = document.getElementById('close-create-journal');
    this.createJournalForm = document.getElementById('create-journal-form');
    this.newJournalNameInput = document.getElementById('new-journal-name');
    this.newJournalPassphraseInput = document.getElementById('new-journal-passphrase');
    this.newJournalPassphraseConfirmInput = document.getElementById(
      'new-journal-passphrase-confirm'
    );
    this.confirmCreateBtn = document.getElementById('confirm-create');
    this.cancelCreateBtn = document.getElementById('cancel-create');
    this.createError = document.getElementById('create-error');

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

    // Advance day modal
    this.advanceDayModal = document.getElementById('advance-day-modal');
    this.confirmAdvanceBtn = document.getElementById('confirm-advance');
    this.cancelAdvanceBtn = document.getElementById('cancel-advance');
  }

  attachEventListeners() {
    // Unlock form
    this.unlockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUnlock();
    });

    // Create new journal
    this.createNewBtn.addEventListener('click', () => this.showCreateJournalModal());
    this.closeCreateJournalBtn.addEventListener('click', () => this.hideCreateJournalModal());
    this.confirmCreateBtn.addEventListener('click', () => this.handleCreateJournal());
    this.cancelCreateBtn.addEventListener('click', () => this.hideCreateJournalModal());
    this.createJournalModal.addEventListener('click', (e) => {
      if (e.target === this.createJournalModal) {
        this.hideCreateJournalModal();
      }
    });

    // Date navigation
    this.dateSelector.addEventListener('change', () => {
      const selectedDate = this.dateSelector.value;

      // Validate that the selected date exists
      if (!this.dayExists(selectedDate)) {
        // Revert to current date and show warning
        this.dateSelector.value = this.currentDate;
        console.warn('Cannot select date with no journal entry:', selectedDate);
        return;
      }

      this.loadDate(selectedDate);
    });

    this.prevDayBtn.addEventListener('click', () => this.navigateDay(-1));
    this.nextDayBtn.addEventListener('click', () => this.navigateDay(1));
    this.todayBtn.addEventListener('click', () => this.goToCurrentEditableDay());

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

    // Advance day modal
    this.confirmAdvanceBtn.addEventListener('click', () => this.confirmAdvanceDay());
    this.cancelAdvanceBtn.addEventListener('click', () => this.hideAdvanceModal());
    this.advanceDayModal.addEventListener('click', (e) => {
      if (e.target === this.advanceDayModal) {
        this.hideAdvanceModal();
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
        await this.loadExistingDays();
        this.goToCurrentEditableDay();
      } else {
        this.showUnlock();
      }
      // eslint-disable-next-line no-unused-vars
    } catch (err) {
      this.showUnlock();
    }
  }

  async handleUnlock() {
    const journalName = this.journalNameInput.value.trim();
    const passphrase = this.passphraseInput.value;
    this.unlockError.textContent = '';

    if (!journalName) {
      this.unlockError.textContent = 'Journal name is required';
      return;
    }

    try {
      await api.unlock(journalName, passphrase);
      this.showApp();
      await this.loadExistingDays();
      this.goToCurrentEditableDay();
    } catch (err) {
      this.unlockError.textContent = err.message;
    }
  }

  showCreateJournalModal() {
    this.createJournalModal.classList.remove('hidden');
    this.createError.textContent = '';
    this.newJournalNameInput.value = '';
    this.newJournalPassphraseInput.value = '';
    this.newJournalPassphraseConfirmInput.value = '';
  }

  hideCreateJournalModal() {
    this.createJournalModal.classList.add('hidden');
  }

  async handleCreateJournal() {
    const journalName = this.newJournalNameInput.value.trim();
    const passphrase = this.newJournalPassphraseInput.value;
    const passphraseConfirm = this.newJournalPassphraseConfirmInput.value;
    this.createError.textContent = '';

    if (!journalName) {
      this.createError.textContent = 'Journal name is required';
      return;
    }

    if (!passphrase) {
      this.createError.textContent = 'Passphrase is required';
      return;
    }

    if (passphrase !== passphraseConfirm) {
      this.createError.textContent = 'Passphrases do not match';
      return;
    }

    if (passphrase.length < 8) {
      this.createError.textContent = 'Passphrase must be at least 8 characters';
      return;
    }

    try {
      await api.createJournal(journalName, passphrase);
      this.hideCreateJournalModal();

      // Auto-fill the unlock form
      this.journalNameInput.value = journalName;
      this.passphraseInput.value = passphrase;

      // Show success message
      this.unlockError.style.color = 'var(--success-color)';
      this.unlockError.textContent = `Journal "${journalName}" created successfully! Click Unlock to open it.`;

      setTimeout(() => {
        this.unlockError.style.color = '';
        this.unlockError.textContent = '';
      }, 3000);
    } catch (err) {
      this.createError.textContent = err.message;
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

  async loadExistingDays() {
    try {
      const days = await api.getDays();
      this.existingDays = days.map((d) => d.date).sort();

      // Current editable day is the most recent day
      if (this.existingDays.length > 0) {
        this.currentEditableDay = this.existingDays[this.existingDays.length - 1];
      } else {
        // No days exist, create first day with today's date
        const today = this.getTodayDate();
        await api.getDay(today); // This creates the day
        this.existingDays = [today];
        this.currentEditableDay = today;
      }
    } catch (err) {
      console.error('Failed to load existing days:', err);
    }
  }

  goToCurrentEditableDay() {
    if (this.currentEditableDay) {
      this.dateSelector.value = this.currentEditableDay;
      this.loadDate(this.currentEditableDay);
    }
  }

  getTodayDate() {
    return new Date().toISOString().split('T')[0];
  }

  isCurrentEditableDay(dateString) {
    return dateString === this.currentEditableDay;
  }

  dayExists(dateString) {
    return this.existingDays.includes(dateString);
  }

  canAdvanceDay() {
    // Can only advance if current editable day is before today
    const today = this.getTodayDate();
    return this.currentEditableDay < today;
  }

  navigateDay(offset) {
    if (offset === 1) {
      // Check if we're already at the current editable day
      if (this.isViewingCurrentEditableDay) {
        // Check if we can advance (current editable day must be before today)
        if (this.canAdvanceDay()) {
          // Advancing forward - show confirmation dialog
          this.showAdvanceModal();
        }
        return;
      } else {
        // Navigate forward through existing days
        const currentIndex = this.existingDays.indexOf(this.currentDate);
        if (currentIndex < this.existingDays.length - 1) {
          const newDate = this.existingDays[currentIndex + 1];
          this.dateSelector.value = newDate;
          this.loadDate(newDate);
        }
        return;
      }
    }

    // Going backward
    const currentIndex = this.existingDays.indexOf(this.currentDate);
    if (currentIndex > 0) {
      const newDate = this.existingDays[currentIndex - 1];
      this.dateSelector.value = newDate;
      this.loadDate(newDate);
    }
  }

  showAdvanceModal() {
    this.advanceDayModal.classList.remove('hidden');
  }

  hideAdvanceModal() {
    this.advanceDayModal.classList.add('hidden');
  }

  async confirmAdvanceDay() {
    this.hideAdvanceModal();

    try {
      // Always create new day with today's actual date (skip any missed days)
      const today = this.getTodayDate();

      // Only advance if today is actually after the current editable day
      if (today <= this.currentEditableDay) {
        console.warn('Cannot advance: current editable day is already today or in the future');
        return;
      }

      await api.getDay(today); // This creates the day if it doesn't exist

      // Reload existing days
      await this.loadExistingDays();

      // Navigate to the new current editable day (which should be today)
      this.goToCurrentEditableDay();
    } catch (err) {
      console.error('Failed to advance day:', err);
    }
  }

  async loadDate(dateString) {
    try {
      // Only load dates that exist in the database
      if (!this.dayExists(dateString)) {
        console.warn('Day does not exist:', dateString);
        return;
      }

      this.currentDate = dateString;
      this.isViewingCurrentEditableDay = this.isCurrentEditableDay(dateString);

      // Update UI based on whether we're viewing current editable day
      this.updateUIForDateMode();

      // Get day
      this.currentDay = await api.getDay(dateString);

      // Load windows with read-only mode for past dates
      await this.windowManager.loadWindows(this.currentDay.id, !this.isViewingCurrentEditableDay);

      // Load goals
      await this.loadGoals();
    } catch (err) {
      console.error('Failed to load date:', err);
    }
  }

  updateUIForDateMode() {
    // Set min/max dates on date selector to guide users
    if (this.existingDays.length > 0) {
      this.dateSelector.min = this.existingDays[0];
      this.dateSelector.max = this.existingDays[this.existingDays.length - 1];
    }

    // Update previous day button
    const currentIndex = this.existingDays.indexOf(this.currentDate);
    this.prevDayBtn.disabled = currentIndex <= 0;

    // Update next day button
    if (this.isViewingCurrentEditableDay) {
      // Viewing current editable day, can advance to new day only if it's before today
      const canAdvance = this.canAdvanceDay();
      this.nextDayBtn.disabled = !canAdvance;
      this.nextDayBtn.title = canAdvance ? 'Advance to New Day (→)' : 'Already at current date';
    } else {
      // Viewing a past day, can navigate forward through existing days
      const canGoForward = currentIndex < this.existingDays.length - 1;
      this.nextDayBtn.disabled = !canGoForward;
      this.nextDayBtn.title = canGoForward ? 'Next Day (→)' : 'At current editable day';
    }

    // Update Today button - it goes to current editable day
    this.todayBtn.title = 'Go to Current Journal Entries';

    // Show/hide edit goals button based on viewing current editable day
    if (this.isViewingCurrentEditableDay) {
      this.editGoalsBtn.style.display = '';
    } else {
      this.editGoalsBtn.style.display = 'none';
      // Exit edit mode if we were editing
      if (this.goalsEditMode) {
        this.exitGoalsEditMode();
      }
    }

    // Disable add buttons for past dates
    this.addPromptBtn.disabled = !this.isViewingCurrentEditableDay;
    this.addFreeformBtn.disabled = !this.isViewingCurrentEditableDay;

    if (!this.isViewingCurrentEditableDay) {
      this.addPromptBtn.title = 'Cannot add prompts to past entries';
      this.addFreeformBtn.title = 'Cannot add text to past entries';
    } else {
      this.addPromptBtn.title = 'Add Journal Prompt';
      this.addFreeformBtn.title = 'Add Freeform Text';
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
