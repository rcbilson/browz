// Cast Manager - Handles Google Cast (Chromecast) integration

class CastManager {
  constructor() {
    this.selectedDevice = null;
    this.castContext = null;
    this.currentSession = null;
    this.initialized = false;
    this.resolveInit = null;
    this.rejectInit = null;

    console.log('CastManager created');

    // Check if Cast availability was already determined
    if (window.castAvailable !== null) {
      console.log('Cast availability already known:', window.castAvailable);
      this.onCastAvailable(window.castAvailable);
    }
  }

  onCastAvailable(isAvailable) {
    console.log('CastManager.onCastAvailable called:', isAvailable);
    if (isAvailable) {
      try {
        this.initializeCastApi();
        if (this.resolveInit) {
          this.resolveInit();
        }
      } catch (error) {
        console.error('Error initializing Cast API:', error);
        this.hideSelector();
        if (this.rejectInit) {
          this.rejectInit(error);
        }
      }
    } else {
      console.log('Cast not available on this device - hiding selector');
      this.hideSelector();
      if (this.rejectInit) {
        this.rejectInit(new Error('Cast API not available on this device'));
      }
    }
  }

  async initialize() {
    // Return existing promise if already initializing
    if (this.initialized) {
      console.log('Cast already initialized');
      return Promise.resolve();
    }

    // If we already know Cast is not available, reject immediately
    if (window.castAvailable === false) {
      console.log('Cast known to be unavailable - skipping initialization');
      return Promise.reject(new Error('Cast API not available on this device'));
    }

    // If Cast is already available, resolve immediately
    if (window.castAvailable === true && this.initialized) {
      console.log('Cast already available and initialized');
      return Promise.resolve();
    }

    console.log('Waiting for Cast SDK availability...');
    return new Promise((resolve, reject) => {
      this.resolveInit = resolve;
      this.rejectInit = reject;

      // Set a timeout in case the callback never fires
      setTimeout(() => {
        if (!this.initialized && window.castAvailable === null) {
          console.warn('Cast API initialization timeout - SDK may not have loaded');
          this.hideSelector();
          reject(new Error('Cast API initialization timeout'));
        }
      }, 5000);
    });
  }

  initializeCastApi() {
    const applicationID = chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;
    const sessionRequest = new chrome.cast.SessionRequest(applicationID);
    const apiConfig = new chrome.cast.ApiConfig(
      sessionRequest,
      (session) => this.sessionListener(session),
      (availability) => this.receiverListener(availability)
    );

    chrome.cast.initialize(
      apiConfig,
      () => {
        console.log('Cast API initialized successfully');
        this.initialized = true;
        this.castContext = cast.framework.CastContext.getInstance();
        this.setupUI();
      },
      (error) => {
        console.error('Failed to initialize Cast API:', error);
        this.hideSelector();
      }
    );
  }

  sessionListener(session) {
    console.log('New cast session:', session.sessionId);
    this.currentSession = session;
    this.currentSession.addUpdateListener(() => {
      console.log('Session updated');
    });
  }

  receiverListener(availability) {
    if (availability === chrome.cast.ReceiverAvailability.AVAILABLE) {
      console.log('Chromecast devices available');
      this.updateDeviceList();
    } else {
      console.log('No Chromecast devices available');
      this.showNoDevices();
    }
  }

  setupUI() {
    const selectorBtn = document.getElementById('cast-selector-btn');
    const dropdown = document.getElementById('cast-dropdown');

    if (!selectorBtn || !dropdown) return;

    // Toggle dropdown on button click
    selectorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display !== 'none';
      if (isVisible) {
        dropdown.style.display = 'none';
      } else {
        this.updateDeviceList();
        dropdown.style.display = 'block';
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!selectorBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Update device list periodically
    setInterval(() => {
      if (dropdown.style.display !== 'none') {
        this.updateDeviceList();
      }
    }, 5000);
  }

  updateDeviceList() {
    const deviceList = document.getElementById('cast-device-list');
    if (!deviceList) return;

    if (!this.initialized) {
      deviceList.innerHTML = '<div class="cast-error">Cast not initialized</div>';
      return;
    }

    // Request session to trigger device discovery
    chrome.cast.requestSession(
      (session) => {
        this.currentSession = session;
        this.selectDevice(session.receiver.friendlyName);
        this.closeDropdown();
      },
      (error) => {
        // User cancelled or no devices - this is expected behavior
        if (error.code === 'cancel') {
          // User cancelled the device picker
          this.showAvailableDevices();
        } else {
          console.log('No devices found or error:', error);
          this.showNoDevices();
        }
      }
    );
  }

  showAvailableDevices() {
    const deviceList = document.getElementById('cast-device-list');
    if (!deviceList) return;

    deviceList.innerHTML = `
      <div class="cast-device-item" onclick="window.castManager.requestSession()">
        <span class="cast-device-icon">📡</span>
        <div class="cast-device-info">
          <div class="cast-device-name-item">Select a device...</div>
          <div class="cast-device-status">Click to choose Chromecast</div>
        </div>
      </div>
    `;
  }

  showNoDevices() {
    const deviceList = document.getElementById('cast-device-list');
    if (!deviceList) return;

    deviceList.innerHTML = '<div class="cast-no-devices">No Chromecast devices found on your network.</div>';
  }

  requestSession() {
    chrome.cast.requestSession(
      (session) => {
        this.currentSession = session;
        this.selectDevice(session.receiver.friendlyName);
        this.closeDropdown();
      },
      (error) => {
        console.error('Failed to start session:', error);
      }
    );
  }

  selectDevice(deviceName) {
    this.selectedDevice = deviceName;
    const deviceNameEl = document.getElementById('cast-device-name');
    if (deviceNameEl) {
      deviceNameEl.textContent = deviceName;
    }
  }

  closeDropdown() {
    const dropdown = document.getElementById('cast-dropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
    }
  }

  hideSelector() {
    const container = document.querySelector('.cast-selector-container');
    if (container) {
      container.style.display = 'none';
    }
  }

  async castMedia(mediaUrl, mimeType, title) {
    if (!this.initialized) {
      throw new Error('Cast not initialized');
    }

    if (!this.currentSession) {
      // Try to start a new session
      return new Promise((resolve, reject) => {
        chrome.cast.requestSession(
          (session) => {
            this.currentSession = session;
            this.loadMedia(mediaUrl, mimeType, title, resolve, reject);
          },
          (error) => {
            reject(new Error('No cast session available: ' + error.code));
          }
        );
      });
    } else {
      return new Promise((resolve, reject) => {
        this.loadMedia(mediaUrl, mimeType, title, resolve, reject);
      });
    }
  }

  loadMedia(mediaUrl, mimeType, title, resolve, reject) {
    const mediaInfo = new chrome.cast.media.MediaInfo(mediaUrl, mimeType);
    mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
    mediaInfo.metadata.title = title;

    const request = new chrome.cast.media.LoadRequest(mediaInfo);

    this.currentSession.loadMedia(
      request,
      (media) => {
        console.log('Media loaded successfully:', media.mediaSessionId);
        resolve(media);
      },
      (error) => {
        console.error('Failed to load media:', error);
        reject(new Error('Failed to load media: ' + error.code));
      }
    );
  }

  stopCasting() {
    if (this.currentSession) {
      this.currentSession.stop(
        () => {
          console.log('Session stopped');
          this.currentSession = null;
        },
        (error) => {
          console.error('Failed to stop session:', error);
        }
      );
    }
  }
}

// Initialize Cast Manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.castManager = new CastManager();
  });
} else {
  window.castManager = new CastManager();
}
