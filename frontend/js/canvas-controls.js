// canvas-controls.js - Pan and zoom controls for the canvas

export class CanvasControls {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.zoomLevel = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.minZoom = 0.1;
    this.maxZoom = 2.0;
    this.zoomStep = 0.1;
    this.isPanning = false;

    // UI elements
    this.zoomInBtn = document.getElementById('zoom-in');
    this.zoomOutBtn = document.getElementById('zoom-out');
    this.zoomResetBtn = document.getElementById('zoom-reset');
    this.zoomLevelDisplay = document.getElementById('zoom-level');

    this.init();
  }

  init() {
    this.setupPanning();
    this.setupZooming();
    this.setupButtons();
    this.setupKeyboardShortcuts();
    this.updateTransform();
  }

  setupPanning() {
    // Use native mouse events for panning
    // Only pan when clicking on the container background (not on windows or UI elements)
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const startPan = (e) => {
      // Don't start panning if clicking on interactive elements
      const target = e.target;

      // Check if clicking on core-ui, floating windows, or their children
      if (target.closest('#core-ui') || target.closest('.floating-window')) {
        return;
      }

      // Only start panning if clicking directly on the container background
      if (target === this.container || target.id === 'windows-container') {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        this.container.style.cursor = 'grabbing';
        e.preventDefault();
      }
    };

    const doPan = (e) => {
      if (!isDragging) return;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;

      this.panX += dx / this.zoomLevel;
      this.panY += dy / this.zoomLevel;

      lastX = e.clientX;
      lastY = e.clientY;

      this.updateTransform();
    };

    const endPan = () => {
      if (isDragging) {
        isDragging = false;
        this.updateCursor();
      }
    };

    const updateCursorOnHover = (e) => {
      if (isDragging) return;
      this.updateCursor(e.target);
    };

    this.container.addEventListener('mousedown', startPan);
    this.container.addEventListener('mousemove', updateCursorOnHover);
    window.addEventListener('mousemove', doPan);
    window.addEventListener('mouseup', endPan);

    // Enable pointer events on the container
    this.container.style.pointerEvents = 'auto';
    this.updateCursor();
  }

  updateCursor(target = null) {
    if (!target) {
      this.container.style.cursor = 'default';
      return;
    }

    // Show grab cursor only when hovering over canvas background
    const overInteractive =
      target.closest('#core-ui') ||
      target.closest('.floating-window') ||
      target.closest('#zoom-controls');

    this.container.style.cursor = overInteractive ? 'default' : 'grab';
  }

  setupZooming() {
    // Mouse wheel zoom
    window.addEventListener(
      'wheel',
      (e) => {
        // Check if hovering over UI elements that shouldn't zoom
        const target = e.target;
        const overUI =
          target.closest('#core-ui') ||
          target.closest('.floating-window') ||
          target.closest('#zoom-controls');

        // Allow zoom with Ctrl+wheel anywhere, or plain wheel when not over UI
        const shouldZoom = e.ctrlKey || e.metaKey || !overUI;

        if (shouldZoom) {
          e.preventDefault();

          // Get mouse position relative to viewport
          const mouseX = e.clientX;
          const mouseY = e.clientY;

          // Calculate zoom (smaller delta for plain wheel, larger for Ctrl+wheel)
          const sensitivity = e.ctrlKey || e.metaKey ? 0.001 : 0.0005;
          const delta = -e.deltaY * sensitivity;
          this.zoomToward(mouseX, mouseY, delta);
        }
      },
      { passive: false }
    );
  }

  setupButtons() {
    this.zoomInBtn.addEventListener('click', () => {
      this.zoomToCenter(this.zoomStep);
    });

    this.zoomOutBtn.addEventListener('click', () => {
      this.zoomToCenter(-this.zoomStep);
    });

    this.zoomResetBtn.addEventListener('click', () => {
      this.resetView();
    });
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger when typing in input fields
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return;
      }

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.zoomToCenter(this.zoomStep);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        this.zoomToCenter(-this.zoomStep);
      } else if (e.key === '0') {
        e.preventDefault();
        this.resetView();
      }
    });
  }

  zoomToward(clientX, clientY, delta) {
    const oldZoom = this.zoomLevel;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom + delta));

    if (newZoom === oldZoom) return;

    // Get the position in the canvas coordinate system before zoom
    const canvasX = (clientX - this.panX * oldZoom) / oldZoom;
    const canvasY = (clientY - this.panY * oldZoom) / oldZoom;

    // Update zoom
    this.zoomLevel = newZoom;

    // Adjust pan to keep the mouse position fixed
    this.panX = (clientX - canvasX * newZoom) / newZoom;
    this.panY = (clientY - canvasY * newZoom) / newZoom;

    this.updateTransform();
  }

  zoomToCenter(delta) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    this.zoomToward(centerX, centerY, delta);
  }

  resetView() {
    this.zoomLevel = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
  }

  updateTransform() {
    // Apply the transform to the container
    const transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    this.container.style.transform = transform;

    // Update zoom level display
    const percentage = Math.round(this.zoomLevel * 100);
    this.zoomLevelDisplay.textContent = `${percentage}%`;
  }

  // Public API to get current transform state
  getTransform() {
    return {
      zoom: this.zoomLevel,
      panX: this.panX,
      panY: this.panY,
    };
  }

  // Convert screen coordinates to canvas coordinates
  screenToCanvas(screenX, screenY) {
    return {
      x: (screenX - this.panX * this.zoomLevel) / this.zoomLevel,
      y: (screenY - this.panY * this.zoomLevel) / this.zoomLevel,
    };
  }

  // Convert canvas coordinates to screen coordinates
  canvasToScreen(canvasX, canvasY) {
    return {
      x: canvasX * this.zoomLevel + this.panX * this.zoomLevel,
      y: canvasY * this.zoomLevel + this.panY * this.zoomLevel,
    };
  }
}
