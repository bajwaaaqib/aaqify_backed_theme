/** @odoo-module **/

import { NavBar } from "@web/webclient/navbar/navbar";
import { patch } from "@web/core/utils/patch";
import { onMounted, onWillUnmount } from "@odoo/owl";
import { router } from "@web/core/browser/router";

patch(NavBar.prototype, {
    setup() {
        super.setup();

        if (this.state.isCustomHomeMenuOpen === undefined) {
            this.state.isCustomHomeMenuOpen = false;
        }

        this.customNavHistory = [];
        this._lastTrackedAppId = null;

        this._onCustomHomeMenuKeydown = this.onCustomHomeMenuKeydown.bind(this);
        this._onActionManagerUpdated = this.onActionManagerUpdated.bind(this);
        this._onTopLeftClick = this.onTopLeftClick.bind(this);
        this._onHomeForwardClick = this.onHomeForwardClick.bind(this);
        this._onGlobalAppsMenuClick = this.onGlobalAppsMenuClick.bind(this);

        onMounted(() => {
            this.renderCustomOverlay();
            this.setupTopLeftAppIconAndCaret();

            document.addEventListener("keydown", this._onCustomHomeMenuKeydown);
            
            // Intercept clicks on All Apps / Hamburger toggle globally
            document.addEventListener("click", this._onGlobalAppsMenuClick, true);

            if (this.env.bus) {
                this.env.bus.addEventListener("ACTION_MANAGER:UI-UPDATED", this._onActionManagerUpdated);
            }

            this.trackCurrentAppIfChanged();
            this.restoreCustomHomeMenuOnRefresh();
        });

        onWillUnmount(() => {
            document.removeEventListener("keydown", this._onCustomHomeMenuKeydown);
            document.removeEventListener("click", this._onGlobalAppsMenuClick, true);
            if (this.env.bus) {
                this.env.bus.removeEventListener("ACTION_MANAGER:UI-UPDATED", this._onActionManagerUpdated);
            }
            this.detachTopLeftButtonListeners();
        });
    },

    // ------------------------------------------------------------------
    // Global All Apps Interceptor
    // ------------------------------------------------------------------

    onGlobalAppsMenuClick(ev) {
        // Intercept clicks on All Apps button, navbar toggles, or app icons
        const appsToggleTarget = ev.target.closest(
            ".o_navbar_apps_menu, .o_menu_toggle, .o_home_menu_icon, .custom_home_menu_button"
        );

        if (appsToggleTarget) {
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();

            // Close native dropdowns if open
            const openDropdown = document.querySelector(".dropdown-menu.show");
            if (openDropdown) {
                openDropdown.classList.remove("show");
            }

            this.openCustomHomeMenu();
        }
    },

    // ------------------------------------------------------------------
    // Dynamic App Icon / Back Caret Logic
    // ------------------------------------------------------------------

    getTopLeftButton() {
        return document.querySelector(".o_navbar_apps_menu, .o_menu_toggle, .o_home_menu_icon, .o_navbar_apps_menu > a");
    },

    getHomeForwardButton() {
        return document.getElementById("custom_home_forward_btn");
    },

    setupTopLeftAppIconAndCaret() {
        const btn = this.getTopLeftButton();
        if (!btn) return;

        btn.removeAttribute("data-bs-toggle");
        btn.removeAttribute("data-toggle");

        const openDropdown = document.querySelector(".o_navbar_apps_menu .dropdown-menu, .o_navbar_apps_menu_menu");
        if (openDropdown) {
            openDropdown.style.setProperty("display", "none", "important");
        }

        let currentApp = null;
        try {
            currentApp = this.menuService.getCurrentApp();
        } catch {
            currentApp = null;
        }

        const appIconHtml = currentApp && currentApp.webIconData
            ? `<img src="${currentApp.webIconData}" class="o_app_icon custom_app_icon" alt=""/>`
            : `<i class="oi oi-apps custom_app_icon"></i>`;

        btn.innerHTML = `
            <div class="custom_nav_brand_toggle">
                <i class="oi oi-chevron-left custom_back_caret" title="Home Menu"></i>
                ${appIconHtml}
            </div>
        `;

        btn.removeEventListener("click", this._onTopLeftClick, true);
        btn.addEventListener("click", this._onTopLeftClick, true);
    },

    detachTopLeftButtonListeners() {
        const btn = this.getTopLeftButton();
        if (btn) {
            btn.removeEventListener("click", this._onTopLeftClick, true);
        }
    },

    onTopLeftClick(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();

        const dropdownMenu = document.querySelector(".dropdown-menu.show");
        if (dropdownMenu) {
            dropdownMenu.classList.remove("show");
        }

        this.openCustomHomeMenu();
    },

    onHomeForwardClick(ev) {
        ev.preventDefault();
        ev.stopPropagation();

        if (this.customNavHistory.length > 0) {
            const lastApp = this.customNavHistory[this.customNavHistory.length - 1];
            if (lastApp && lastApp.app) {
                this.closeCustomHomeMenu(false);
                this.execAppNavigation(lastApp.app);
            }
        }
    },

    updateNavButtonsVisibility() {
    const btn = this.getTopLeftButton();
    const forwardBtn = this.getHomeForwardButton();
    const breadcrumbs = document.querySelector(".o_breadcrumb, .o_navbar_breadcrumbs, .o_menu_brand");

    if (this.state.isCustomHomeMenuOpen) {
        // ON HOME DASHBOARD - Hide breadcrumbs/title
        if (btn) btn.style.setProperty("display", "none", "important");
        if (breadcrumbs) breadcrumbs.style.setProperty("display", "none", "important");

        if (forwardBtn) {
            if (this.customNavHistory.length > 0) {
                forwardBtn.style.setProperty("display", "flex", "important");
            } else {
                forwardBtn.style.setProperty("display", "none", "important");
            }
        }
    } else {
        // INSIDE MODULE / APP - Show breadcrumbs/title
        if (forwardBtn) forwardBtn.style.setProperty("display", "none", "important");

        if (btn) {
            btn.style.removeProperty("display");
        }
        if (breadcrumbs) {
            breadcrumbs.style.removeProperty("display");
        }
    }
},

    // ------------------------------------------------------------------
    // History & Navigation Controls
    // ------------------------------------------------------------------

    onActionManagerUpdated() {
        if (this.state.isCustomHomeMenuOpen && window.location.pathname !== "/odoo") {
            this.closeCustomHomeMenu(false);
        }
        this.trackCurrentAppIfChanged();
        this.setupTopLeftAppIconAndCaret();
        this.updateNavButtonsVisibility();
    },

    trackCurrentAppIfChanged() {
        let currentApp = null;
        try {
            currentApp = this.menuService.getCurrentApp();
        } catch {
            currentApp = null;
        }

        if (!currentApp) {
            this.updateNavButtonsVisibility();
            return;
        }

        if (currentApp.id === this._lastTrackedAppId) {
            this.updateNavButtonsVisibility();
            return;
        }
        this._lastTrackedAppId = currentApp.id;

        const lastEntry = this.customNavHistory[this.customNavHistory.length - 1];
        if (lastEntry && lastEntry.id === currentApp.id) {
            this.updateNavButtonsVisibility();
            return;
        }

        this.customNavHistory.push({ id: currentApp.id, app: currentApp });

        if (this.customNavHistory.length > 30) {
            this.customNavHistory.shift();
        }

        this.updateNavButtonsVisibility();
    },

    execAppNavigation(app) {
        if (!app) return;
        if (this.menuService.selectMenu) {
            this.menuService.selectMenu(app);
        } else if (this.onNavBarDropdownItemSelection) {
            this.onNavBarDropdownItemSelection(app);
        }
    },

    getCustomHomeMenuUrl() {
        return `${window.location.origin}/odoo`;
    },

    restoreCustomHomeMenuOnRefresh() {
        const homeUrl = this.getCustomHomeMenuUrl();
        const currentPath = window.location.origin + window.location.pathname;
        if (currentPath !== homeUrl) {
            return;
        }

        setTimeout(() => {
            this.state.isCustomHomeMenuOpen = true;
            document.body.style.overflow = "hidden";
            document.body.classList.add("o_custom_home_menu_shown");
            this.renderCustomOverlay();
            this.updateNavButtonsVisibility();
        }, 150);
    },

    openCustomHomeMenu() {
        this.state.isCustomHomeMenuOpen = true;
        document.body.style.overflow = "hidden";
        document.body.classList.add("o_custom_home_menu_shown");

        if (window.location.pathname !== "/odoo") {
            router.pushState({}, { replace: false });
            if (router.navigate) {
                router.navigate("/odoo");
            }
        }

        this.renderCustomOverlay();
        this.updateNavButtonsVisibility();
    },

    closeCustomHomeMenu(restoreUrl = true) {
        this.state.isCustomHomeMenuOpen = false;
        document.body.style.overflow = "";
        document.body.classList.remove("o_custom_home_menu_shown");

        this.renderCustomOverlay();
        this.updateNavButtonsVisibility();
    },

    // ------------------------------------------------------------------
    // Keybinds & Overlay Renderer
    // ------------------------------------------------------------------

    isBlockingUiOpen() {
        return !!document.querySelector(".o_dialog, .modal.show, .o_command_palette");
    },

    onCustomHomeMenuKeydown(ev) {
        if (ev.key === "Escape") {
            if (this.isBlockingUiOpen()) {
                return;
            }

            ev.preventDefault();

            if (!this.state.isCustomHomeMenuOpen) {
                this.openCustomHomeMenu();
            } else if (this.customNavHistory.length > 0) {
                const lastApp = this.customNavHistory[this.customNavHistory.length - 1];
                if (lastApp && lastApp.app) {
                    this.closeCustomHomeMenu(false);
                    this.execAppNavigation(lastApp.app);
                }
            }
        }
    },

    onAppClick(ev, app) {
        this.closeCustomHomeMenu(false);
        this.execAppNavigation(app);
    },

    renderCustomOverlay() {
        let overlayContainer = document.getElementById("custom_home_menu_overlay_container");
        if (!overlayContainer) {
            overlayContainer = document.createElement("div");
            overlayContainer.id = "custom_home_menu_overlay_container";
            document.body.appendChild(overlayContainer);
        }

        overlayContainer.innerHTML = "";
        if (this.state.isCustomHomeMenuOpen) {
            const overlayHtml = this.renderOverlayHTML();
            overlayContainer.innerHTML = overlayHtml;
            this.attachOverlayEventListeners(overlayContainer);
        }
    },

    renderOverlayHTML() {
        const apps = this.menuService.getApps() || [];
        const appCards = apps
            .map((app) => {
                const iconHtml = app.webIconData
                    ? `<img src="${app.webIconData}" alt=""/>`
                    : `<i class="oi oi-apps"></i>`;

                return `
                <a href="${this.getMenuItemHref ? this.getMenuItemHref(app) : '#'}"
                   class="custom_home_menu_app_card"
                   data-menu-xmlid="${app.xmlid || ''}"
                   data-section="${app.id}"
                   data-app-id="${app.id}">
                  <div class="custom_home_menu_app_icon">
                    ${iconHtml}
                  </div>
                </a>
            `;
            })
            .join("");

        const hasHistory = this.customNavHistory.length > 0;
        const forwardBtnDisplay = hasHistory ? "flex" : "none";

        return `
            <div class="custom_home_menu_overlay">
              <div class="custom_home_header_bar">
                 <button id="custom_home_forward_btn" 
                         class="btn custom_forward_btn" 
                         style="display: ${forwardBtnDisplay} !important;">
                    <i class="oi oi-chevron-right"></i>
                 </button>
              </div>
              <div class="custom_home_menu_container">
                <div class="custom_home_menu_grid">
                  ${appCards}
                </div>
              </div>
            </div>
        `;
    },

    attachOverlayEventListeners(container) {
        const forwardBtn = container.querySelector("#custom_home_forward_btn");
        if (forwardBtn) {
            forwardBtn.addEventListener("click", this._onHomeForwardClick);
        }

        const appCards = container.querySelectorAll(".custom_home_menu_app_card");
        appCards.forEach((card) => {
            card.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const appId = parseInt(card.dataset.appId, 10);
                const app = this.menuService.getApps().find((a) => a.id === appId);
                if (app) {
                    this.onAppClick(e, app);
                }
            });
        });
    },
});

patch(NavBar, {
    template: "web.NavBar",
});