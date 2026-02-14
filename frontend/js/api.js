// api.js - API client for backend communication

const API_BASE = 'http://localhost:3000/api';

class APIClient {
  constructor() {
    this.unlocked = false;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Authentication
  async unlock(passphrase) {
    const result = await this.request('/unlock', {
      method: 'POST',
      body: JSON.stringify({ passphrase }),
    });
    this.unlocked = true;
    return result;
  }

  async lock() {
    const result = await this.request('/lock', { method: 'POST' });
    this.unlocked = false;
    return result;
  }

  async getStatus() {
    return this.request('/status');
  }

  // Days
  async getDays() {
    return this.request('/days');
  }

  async getDay(date) {
    return this.request(`/days/${date}`);
  }

  // Persistent Goals
  async getGoals(dayId) {
    return this.request(`/days/${dayId}/goals`);
  }

  async updateGoals(dayId, content) {
    return this.request(`/days/${dayId}/goals`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  // Floating Windows
  async getWindows(dayId) {
    return this.request(`/days/${dayId}/windows`);
  }

  async createWindow(dayId, windowData) {
    return this.request(`/days/${dayId}/windows`, {
      method: 'POST',
      body: JSON.stringify(windowData),
    });
  }

  async updateWindow(windowId, updates) {
    return this.request(`/windows/${windowId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteWindow(windowId) {
    return this.request(`/windows/${windowId}`, {
      method: 'DELETE',
    });
  }

  // Journal Prompts
  async getPrompts(category = null) {
    const endpoint = category ? `/prompts?category=${category}` : '/prompts';
    return this.request(endpoint);
  }

  async getPromptCategories() {
    return this.request('/prompts/categories');
  }
}

export const api = new APIClient();
