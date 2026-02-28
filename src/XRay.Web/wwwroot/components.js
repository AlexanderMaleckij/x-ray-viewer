class MetadataRow extends HTMLElement {
    static get observedAttributes() {
        return ['name'];
    }

    get name() {
        return this.getAttribute('name') || '';
    }

    // value is the element's text content (children)
    get value() {
        return this.innerHTML.trim();
    }

    connectedCallback() {
        // This component is purely declarative — rendering is done by metadata-table
        this.style.display = 'none';
    }
}

customElements.define('metadata-row', MetadataRow);

class MetadataTable extends HTMLElement {
    static get observedAttributes() {
        return ['caption', 'field-label', 'value-label', 'no-data-label'];
    }

    connectedCallback() {
        this._render();
        // Re-render if children (metadata-row) are added/removed
        this._observer = new MutationObserver(() => this._render());
        this._observer.observe(this, { childList: true, attributes: true, subtree: true });
    }

    disconnectedCallback() {
        this._observer?.disconnect();
    }

    attributeChangedCallback() {
        this._render();
    }

    _render() {
        const caption = this.getAttribute('caption') || '';
        const fieldLabel = this.getAttribute('field-label') || 'Field';
        const valueLabel = this.getAttribute('value-label') || 'Value';
        const noDataLabel = this.getAttribute('no-data-label') || 'No Data';

        const fields = [...this.querySelectorAll('metadata-row')];

        const rows = fields.map((col, i) => `
      <tr class="${i % 2 === 1 ? 'even' : ''}">
        <td class="field-cell">${col.name}</td>
        <td class="value-cell">${col.value}</td>
      </tr>
    `).join('');

        const shadow = this.shadowRoot || this.attachShadow({ mode: 'open' });

        shadow.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
        }

        .wrapper {
          background: #16161e;
          border: 1px solid #2a2a3a;
          border-radius: 6px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(120, 120, 200, 0.05),
            0 8px 32px rgba(0,0,0,0.5),
            0 2px 8px rgba(0,0,0,0.4);
          min-width: 360px;
        }

        caption-row {
          display: block;
          padding: 14px 20px 12px;
          background: #1e1e2a;
          border-bottom: 1px solid #2a2a3a;
          font-size: 13pt;
          font-weight: 600;
          color: #c8c8e8;
          letter-spacing: 0.03em;
          font-family: 'IBM Plex Mono', monospace;
          position: relative;
        }

        caption-row::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, #7878d0 0%, #4a4a9a 100%);
          border-radius: 0 2px 2px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13pt;
        }

        thead tr {
          background: #1a1a28;
        }

        th {
          padding: 10px 20px;
          text-align: left;
          color: #7878a0;
          font-weight: 600;
          font-size: 9pt;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-family: 'IBM Plex Mono', monospace;
          border-bottom: 1px solid #2a2a3a;
        }

        td {
          padding: 9px 20px;
          border-bottom: 1px solid #1e1e2a;
          vertical-align: middle;
          color: #d0d0e8;
          line-height: 1.5;
        }

        tr.even td {
          background: rgba(255,255,255,0.02);
        }

        tr:last-child td {
          border-bottom: none;
        }

        .field-cell {
          color: #8888b0;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11pt;
          width: 45%;
          white-space: nowrap;
        }

        .value-cell {
          color: #e0e0f8;
          font-weight: 400;
        }

        tbody tr {
          transition: background 0.15s ease;
        }

        tbody tr:hover td {
          background: rgba(100,100,180,0.08) !important;
        }

        .empty-state {
          padding: 24px 20px;
          text-align: center;
          color: #4a4a6a;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11pt;
        }
      </style>

      <div class="wrapper">
        ${caption ? `<caption-row>${caption}</caption-row>` : ''}
        <table>
          <thead>
            <tr>
              <th>${fieldLabel}</th>
              <th>${valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="2"><div class="empty-state">— ${noDataLabel} —</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
    }
}

customElements.define('metadata-table', MetadataTable);

class MetadataImage extends HTMLElement {
    static get observedAttributes() {
        return ['src', 'label'];
    }

    constructor() {
        super();
        this._rotation = 0;
        this._flipped = false;
    }

    get src() { return this.getAttribute('src') || ''; }
    set src(val) {
        if (val) this.setAttribute('src', val);
        else this.removeAttribute('src');
    }

    get label() { return this.getAttribute('label') || ''; }
    set label(val) { this.setAttribute('label', val); }

    connectedCallback() {
        if (!this.shadowRoot) this._buildSkeleton();
        this._applyState();
    }

    attributeChangedCallback(name) {
        if (!this.shadowRoot) return;
        if (name === 'src') this._applyState();
        if (name === 'label') {
            const el = this.shadowRoot.querySelector('.user-label');
            if (el) el.textContent = this.label;
        }
    }

    _buildSkeleton() {
        const shadow = this.attachShadow({ mode: 'open' });

        shadow.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          box-sizing: border-box;
          background: #16161e;
          border: 1px solid #2a2a3a;
          border-radius: 6px;
          box-shadow:
            0 0 0 1px rgba(120,120,200,0.05),
            0 8px 32px rgba(0,0,0,0.5),
            0 2px 8px rgba(0,0,0,0.4);
          overflow: hidden;
        }

        .grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(120,120,200,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120,120,200,0.04) 1px, transparent 1px);
          background-size: 24px 24px;
          transition: opacity 0.3s ease;
        }

        svg.crosshair {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
          transition: opacity 0.3s ease;
        }

        img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          opacity: 0;
          transition: opacity 0.3s ease, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 5px;
          transform-origin: center center;
        }

        img.loaded { opacity: 1; }

        :host(.has-src) .grid,
        :host(.has-src) svg.crosshair { opacity: 0; pointer-events: none; }

        .user-label {
          position: absolute;
          top: 10px;
          left: 0; right: 0;
          text-align: center;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9pt;
          color: #6060a0;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          pointer-events: none;
          user-select: none;
          transition: color 0.3s ease, text-shadow 0.3s ease;
        }

        :host(.has-src.image-loaded) .user-label {
          color: rgba(200,200,240,0.75);
          text-shadow: 0 1px 4px rgba(0,0,0,0.8);
        }

        /* Toolbar */
        .toolbar {
          position: absolute;
          bottom: 10px;
          right: 10px;
          display: flex;
          gap: 6px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s ease;
        }

        :host(.image-loaded) .toolbar {
          opacity: 1;
          pointer-events: all;
        }

        .toolbar button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          background: rgba(22, 22, 30, 0.75);
          border: 1px solid rgba(120, 120, 200, 0.25);
          border-radius: 4px;
          color: rgba(180, 180, 230, 0.7);
          cursor: pointer;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .toolbar button:hover {
          background: rgba(120, 120, 200, 0.18);
          border-color: rgba(120, 120, 200, 0.55);
          color: rgba(220, 220, 255, 1);
          box-shadow: 0 0 8px rgba(120, 120, 200, 0.25);
        }

        .toolbar button:active {
          transform: scale(0.9);
          background: rgba(120, 120, 200, 0.3);
        }

        .toolbar button.active {
          background: rgba(120, 120, 200, 0.2);
          border-color: rgba(120, 120, 200, 0.6);
          color: rgba(200, 200, 255, 1);
          box-shadow: 0 0 6px rgba(120, 120, 200, 0.3);
        }

        .toolbar button svg {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          /* override the absolute-inset rule for the crosshair svg */
          position: static;
          inset: unset;
          overflow: visible;
        }
      </style>

      <div class="grid"></div>

      <svg class="crosshair" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <line x1="50" y1="46"  x2="50" y2="37"  stroke="#7878d0" stroke-width="0.8" stroke-linecap="round" opacity="0.7"/>
        <line x1="50" y1="54"  x2="50" y2="63"  stroke="#7878d0" stroke-width="0.8" stroke-linecap="round" opacity="0.7"/>
        <line x1="46" y1="50"  x2="37" y2="50"  stroke="#7878d0" stroke-width="0.8" stroke-linecap="round" opacity="0.7"/>
        <line x1="54" y1="50"  x2="63" y2="50"  stroke="#7878d0" stroke-width="0.8" stroke-linecap="round" opacity="0.7"/>
        <circle cx="50" cy="50" r="1.4" fill="#7878d0" opacity="0.9"/>
        <line x1="46" y1="46" x2="42" y2="42" stroke="#3a3a60" stroke-width="0.6" opacity="0.5"/>
        <line x1="54" y1="46" x2="58" y2="42" stroke="#3a3a60" stroke-width="0.6" opacity="0.5"/>
        <line x1="46" y1="54" x2="42" y2="58" stroke="#3a3a60" stroke-width="0.6" opacity="0.5"/>
        <line x1="54" y1="54" x2="58" y2="58" stroke="#3a3a60" stroke-width="0.6" opacity="0.5"/>
        <path d="M8,14 L8,8 L14,8"   fill="none" stroke="#4a4a9a" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
        <path d="M86,8  L92,8 L92,14" fill="none" stroke="#4a4a9a" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
        <path d="M8,86  L8,92 L14,92" fill="none" stroke="#4a4a9a" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
        <path d="M86,92 L92,92 L92,86" fill="none" stroke="#4a4a9a" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
      </svg>

      <img alt="" />
      <div class="user-label"></div>

      <div class="toolbar">
        <button class="btn-rotate" title="Rotate 90°" aria-label="Rotate image 90 degrees">
          <!-- rotate-cw icon -->
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13.5 2.5v4h-4"/>
            <path d="M13.28 6.35A6 6 0 1 0 12 12"/>
          </svg>
        </button>
        <button class="btn-flip" title="Flip horizontal" aria-label="Flip image horizontally">
          <!-- flip-horizontal icon -->
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 2L8 8L3 14"/>
            <path d="M13 2L8 8L13 14"/>
            <line x1="8" y1="1" x2="8" y2="15" stroke-dasharray="2 2"/>
          </svg>
        </button>
        <button class="btn-open" title="Open in new tab" aria-label="Open image in new tab">
          <!-- external-link icon -->
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"/>
            <path d="M10 2h4v4"/>
            <line x1="14" y1="2" x2="7" y2="9"/>
          </svg>
        </button>
        <button class="btn-print" title="Print image" aria-label="Print image">
          <!-- printer icon -->
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="1" width="8" height="5" rx="0.5"/>
            <path d="M4 11H2.5A1.5 1.5 0 0 1 1 9.5v-3A1.5 1.5 0 0 1 2.5 5h11A1.5 1.5 0 0 1 15 6.5v3A1.5 1.5 0 0 1 13.5 11H12"/>
            <rect x="4" y="9" width="8" height="6" rx="0.5"/>
            <line x1="6" y1="12" x2="10" y2="12"/>
            <line x1="6" y1="14" x2="10" y2="14"/>
            <circle cx="12.5" cy="7.5" r="0.75" fill="currentColor" stroke="none"/>
          </svg>
        </button>
      </div>
    `;

        shadow.querySelector('.user-label').textContent = this.label;

        // Shared transform updater
        const applyTransform = () => {
            const img = shadow.querySelector('img');
            img.style.transform = [
                `rotate(${this._rotation}deg)`,
                this._flipped ? 'scaleX(-1)' : '',
            ].filter(Boolean).join(' ');
        };

        // Rotate button
        shadow.querySelector('.btn-rotate').addEventListener('click', () => {
            this._rotation = (this._rotation + 90) % 360;
            applyTransform();
        });

        // Flip button
        shadow.querySelector('.btn-flip').addEventListener('click', () => {
            this._flipped = !this._flipped;
            shadow.querySelector('.btn-flip').classList.toggle('active', this._flipped);
            applyTransform();
        });

        // Print button
        shadow.querySelector('.btn-print').addEventListener('click', () => {
            const img = shadow.querySelector('img');
            if (!img || !img.src) return;

            const toBlobUrl = (src) => {
                const [header, data] = src.split(',');
                const mime = header.match(/:(.*?);/)[1];
                const binary = atob(data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                return URL.createObjectURL(new Blob([bytes], { type: mime }));
            };

            const blobUrl = img.src.startsWith('data:') ? toBlobUrl(img.src) : img.src;
            const win = window.open(blobUrl, '_blank');
            if (!win) return;

            win.onload = () => {
                win.focus();
                win.print();
                win.onafterprint = () => {
                    win.close();
                    if (img.src.startsWith('data:')) URL.revokeObjectURL(blobUrl);
                };
            };
        });
        shadow.querySelector('.btn-open').addEventListener('click', () => {
            const img = shadow.querySelector('img');
            if (!img || !img.src) return;

            // Convert base64 data URL → Blob URL, which browsers allow opening in a new tab
            const src = img.src;
            if (src.startsWith('data:')) {
                const [header, data] = src.split(',');
                const mime = header.match(/:(.*?);/)[1];
                const binary = atob(data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: mime });
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.click();
                // Revoke after a short delay to allow the tab to load
                setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            } else {
                const a = document.createElement('a');
                a.href = src;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.click();
            }
        });
    }

    _applyState() {
        const shadow = this.shadowRoot;
        const src = this.src;
        const img = shadow.querySelector('img');

        // Reset rotation and flip when a new src is set
        this._rotation = 0;
        this._flipped = false;
        if (this.shadowRoot) {
            this.shadowRoot.querySelector('.btn-flip')?.classList.remove('active');
        }
        img.style.transform = '';

        if (src) {
            this.classList.add('has-src');
            this.classList.remove('image-loaded');
            img.classList.remove('loaded');
            img.alt = this.label;
            img.src = src;

            img.onload = () => {
                img.classList.add('loaded');
                this.classList.add('image-loaded');
            };
            img.onerror = () => {
                this.classList.remove('has-src', 'image-loaded');
                img.removeAttribute('src');
            };
        } else {
            this.classList.remove('has-src', 'image-loaded');
            img.classList.remove('loaded');
            img.removeAttribute('src');
        }
    }
}

customElements.define('metadata-image', MetadataImage);

class LoadingOverlay extends HTMLElement {
  static get observedAttributes() {
        return ['message', 'note', 'visible'];
    }

  get visible() { return this.getAttribute('visible') === 'true'; }
  set visible(val) {
        if (val) this.setAttribute('visible', 'true');
        else this.removeAttribute('visible');
    }

  get message() { return this.getAttribute('message') || ''; }
  set message(val) { this.setAttribute('message', val); }

  get note() {
        return this.getAttribute('note') || '';
    }
  set note(val) { this.setAttribute('note', val); }

    connectedCallback() {
        if (!this.shadowRoot) this._build();
        this._syncVisibility();
    }

    attributeChangedCallback(name) {
        if (!this.shadowRoot) return;
        if (name === 'visible') this._syncVisibility();
        if (name === 'message') {
            const el = this.shadowRoot.querySelector('.message');
            if (el) el.textContent = this.message;
        }
        if (name === 'note') {
            const el = this.shadowRoot.querySelector('.note');
            if (el) el.textContent = this.note;
        }
    }

    _build() {
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
      <style>
        :host {
          /* honour the user's .overlay positioning rules */
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          z-index: 9999;
          /* visual treatment */
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 10, 14, 0.82);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          transition: opacity 0.25s ease, visibility 0.25s ease;
          opacity: 1;
          visibility: visible;
          box-sizing: border-box;
        }

        :host(:not([visible])) {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        /* card */
        .card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding: 32px 40px;
          background: #16161e;
          border: 1px solid #2a2a3a;
          border-radius: 8px;
          box-shadow:
            0 0 0 1px rgba(120,120,200,0.06),
            0 16px 48px rgba(0,0,0,0.7),
            0 4px 12px rgba(0,0,0,0.5);
          position: relative;
          overflow: hidden;
        }

        /* top accent bar */
        .card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, #4a4a9a 0%, #7878d0 50%, #4a4a9a 100%);
          background-size: 200% 100%;
          animation: shimmer 2.5s linear infinite;
        }

        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* spinner */
        .spinner-wrap {
          position: relative;
          width: 52px;
          height: 52px;
        }

        .ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid transparent;
        }

        .ring-outer {
          border-top-color: #7878d0;
          border-right-color: rgba(120,120,208,0.25);
          border-bottom-color: transparent;
          border-left-color: rgba(120,120,208,0.25);
          animation: spin 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .ring-inner {
          inset: 9px;
          border-top-color: transparent;
          border-right-color: transparent;
          border-bottom-color: #4a4a9a;
          border-left-color: rgba(74,74,154,0.3);
          animation: spin 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse;
        }

        .ring-dot {
          inset: 22px;
          border-radius: 50%;
          background: #7878d0;
          border: none;
          opacity: 0.9;
          animation: pulse 1.1s ease-in-out infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.6); }
        }

        /* text */
        .message {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12pt;
          font-weight: 600;
          color: #c8c8e8;
          letter-spacing: 0.06em;
          text-align: center;
        }

        .note {
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 9pt;
          color: #5a5a7a;
          letter-spacing: 0.03em;
          text-align: center;
          max-width: 260px;
          line-height: 1.6;
        }
      </style>

      <div class="card">
        <div class="spinner-wrap">
          <div class="ring ring-outer"></div>
          <div class="ring ring-inner"></div>
          <div class="ring ring-dot"></div>
        </div>
        <div class="message">${this.message}</div>
        <div class="note">${this.note}</div>
      </div>
    `;
    }

    _syncVisibility() {
        // visibility is driven purely by the [visible] attribute via CSS :host selector
        // nothing extra needed — kept for potential future hooks
    }
}

customElements.define('loading-overlay', LoadingOverlay);
