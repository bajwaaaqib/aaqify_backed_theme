/** @odoo-module **/

import { NavBar } from "@web/webclient/navbar/navbar";
import { patch } from "@web/core/utils/patch";
import { onMounted, onWillUnmount } from "@odoo/owl";

patch(NavBar.prototype, {
    setup() {
        super.setup();

        if (this.state.isCustomHomeMenuOpen === undefined) {
            this.state.isCustomHomeMenuOpen = false;
        }

        this._onCustomHomeMenuKeydown = this.onCustomHomeMenuKeydown.bind(this);
        this._onGlobalClick = this.onGlobalClick.bind(this);
        this._onPopState = this.onPopState.bind(this);
        this._onRouteChange = this.onRouteChange.bind(this);

        onMounted(() => {
            this.renderCustomOverlay();
            this.bindBrandClick();
            document.addEventListener("keydown", this._onCustomHomeMenuKeydown);
            document.addEventListener("click", this._onGlobalClick);
            window.addEventListener("popstate", this._onPopState);
            /* Odoo's router emits ROUTE_CHANGE on its main bus whenever the
               current route changes (back/forward navigation, command palette
               navigation, app switches, etc). This is the hook we need to keep
               the custom overlay in sync with the real URL/view, instead of
               only reacting to clicks we generate ourselves. */
            this.env.bus.addEventListener("ROUTE_CHANGE", this._onRouteChange);
            this.restoreCustomHomeMenuOnRefresh();
        });

        onWillUnmount(() => {
            document.removeEventListener("keydown", this._onCustomHomeMenuKeydown);
            document.removeEventListener("click", this._onGlobalClick);
            window.removeEventListener("popstate", this._onPopState);
            this.env.bus.removeEventListener("ROUTE_CHANGE", this._onRouteChange);
        });
    },

    toggleCustomHomeMenu() {
        if (this.state.isCustomHomeMenuOpen) {
            this.closeCustomHomeMenu();
        } else {
            this.openCustomHomeMenu();
        }
    },

    getCustomHomeMenuUrl() {
        return `${window.location.origin}/odoo`;
    },

    restoreCustomHomeMenuOnRefresh() {
        const homeUrl = this.getCustomHomeMenuUrl();
        const currentPath = window.location.origin + window.location.pathname;

        if (currentPath === homeUrl || window.location.hash === "" || window.location.hash === "#") {
            setTimeout(() => {
                this.state.isCustomHomeMenuOpen = true;
                document.body.classList.add("o_custom_home_menu_shown");
                this.renderCustomOverlay();
            }, 50);
        }
    },

    /* Keep the overlay in sync whenever the URL actually changes to/away
       from the home screen, regardless of what triggered the navigation
       (browser back/forward, Ctrl+K command palette, breadcrumbs, etc).
       This does NOT touch history itself - it only reconciles our overlay
       state with whatever URL is already showing, so it never fights with
       Odoo's own router. */
    syncCustomHomeMenuWithUrl() {
        const homeUrl = this.getCustomHomeMenuUrl();
        const currentUrl = window.location.origin + window.location.pathname;

        if (currentUrl === homeUrl) {
            if (!this.state.isCustomHomeMenuOpen) {
                this.state.isCustomHomeMenuOpen = true;
                document.body.classList.add("o_custom_home_menu_shown");
                this.renderCustomOverlay();
            }
        } else if (this.state.isCustomHomeMenuOpen) {
            this.state.isCustomHomeMenuOpen = false;
            document.body.classList.remove("o_custom_home_menu_shown");
            this.renderCustomOverlay();
        }
    },

    onPopState() {
        /* Fires on browser Back/Forward. */
        this.syncCustomHomeMenuWithUrl();
    },

    onRouteChange() {
        /* Fires whenever Odoo's router changes the current route, e.g. after
           picking a result in the Ctrl+K command palette, clicking a
           breadcrumb, or any programmatic navigation - not just Back/Forward. */
        this.syncCustomHomeMenuWithUrl();
    },

    openCustomHomeMenu() {
        this.state.isCustomHomeMenuOpen = true;
        document.body.classList.add("o_custom_home_menu_shown");

        const homeUrl = this.getCustomHomeMenuUrl();
        if (window.location.href !== homeUrl) {
            /* Remember where we came from so closeCustomHomeMenu() can
               actually restore it - this was previously never set. */
            this.customHomeMenuPreviousUrl = window.location.href;
            window.history.pushState({ customHomeMenu: true }, "", homeUrl);
        }

        this.renderCustomOverlay();
    },

    closeCustomHomeMenu(restoreUrl = true) {
        this.state.isCustomHomeMenuOpen = false;
        document.body.classList.remove("o_custom_home_menu_shown");

        if (restoreUrl && this.customHomeMenuPreviousUrl) {
            window.history.pushState({}, "", this.customHomeMenuPreviousUrl);
        }

        this.customHomeMenuPreviousUrl = null;
        this.renderCustomOverlay();
    },

    onCustomHomeMenuKeydown(ev) {
        if (!this.state.isCustomHomeMenuOpen) {
            return;
        }

        if (ev.key === "Escape") {
            ev.preventDefault();
            this.closeCustomHomeMenu(false);
        }
    },

    onGlobalClick(ev) {
        /* Intercept 'All Apps' inside mobile sidebar drawer */
        const allAppsBtn = ev.target.closest('.o_navbar_apps_menu button, [data-menu-xmlid], .o_apps_menu_button, .o_all_apps_btn, .o_menu_sections_toggle, .dropdown-item');
        
        if (allAppsBtn && (allAppsBtn.innerText.includes("All Apps") || allAppsBtn.querySelector('.fa-th, .oi-apps') || ev.target.classList.contains('oi-apps'))) {
            ev.preventDefault();
            ev.stopPropagation();

            /* Properly close Odoo 18 Bootstrap Offcanvas drawer */
            const offcanvasCloseBtn = document.querySelector('.offcanvas.show .btn-close');
            if (offcanvasCloseBtn) {
                // Mimic native close click
                offcanvasCloseBtn.click(); 
            } else {
                // Fallback forceful removal
                const activeDrawer = document.querySelector('.offcanvas.show, .o_navbar_mobile_sidebar.show, .o_burger_menu.show');
                if (activeDrawer) {
                    activeDrawer.classList.remove('show');
                }
                const backdrop = document.querySelector('.offcanvas-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
                document.body.style.overflow = '';
            }

            this.openCustomHomeMenu();
        }
    },

    bindBrandClick() {
        const brand = document.querySelector(".o_menu_brand");
        if (brand) {
            const currentApp = this.menuService.getCurrentApp();

            /* Ensure app name is present if DOM cleared it */
            if (currentApp && (!brand.innerText || brand.innerText.trim() === "")) {
                brand.innerText = currentApp.name;
            }

            if (currentApp) {
                const iconUrl = currentApp.webIconData
                    ? currentApp.webIconData
                    : (currentApp.webIcon ? currentApp.webIcon.replace(',', '/') : '');
                
                if (iconUrl) {
                    let styleTag = document.getElementById("custom_menu_brand_style");
                    if (!styleTag) {
                        styleTag = document.createElement("style");
                        styleTag.id = "custom_menu_brand_style";
                        document.head.appendChild(styleTag);
                    }
                    styleTag.innerHTML = `@media (min-width: 769px) { .o_menu_brand::before { background-image: url('${iconUrl}') !important; } }`;
                }
            }

            if (!brand.dataset.customBound) {
                brand.dataset.customBound = "true";
                brand.addEventListener("click", (e) => {
                    /* Only trigger Home Menu overlay on Desktop */
                    if (window.innerWidth > 768) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.openCustomHomeMenu();
                    }
                });
            }
        }
    },

    onAppClick(ev, app) {
        this.closeCustomHomeMenu(false);
        this.menuService.selectMenu(app);
        setTimeout(() => this.bindBrandClick(), 100);
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
            overlayContainer.innerHTML = this.renderOverlayHTML();
            this.attachOverlayEventListeners(overlayContainer);
        }
    },

    renderOverlayHTML() {
        const apps = this.menuService.getApps();
        const appCards = apps
            .map((app) => {
                const iconUrl = app.webIconData
                    ? app.webIconData
                    : (app.webIcon ? app.webIcon.replace(',', '/') : '');

                const iconHtml = iconUrl
                    ? `<img src="${iconUrl}" alt="${app.name}"/>`
                    : `<i class="oi oi-apps"></i>`;

                return `
                <a href="${this.getMenuItemHref(app)}"
                   class="custom_home_menu_app_card"
                   data-app-id="${app.id}">
                  <div class="custom_home_menu_app_icon">
                    ${iconHtml}
                  </div>
                  <div class="custom_home_menu_app_name">${app.name}</div>
                </a>
            `;
            })
            .join("");

        return `
            <div class="custom_home_menu_overlay">
              <div class="custom_home_menu_container">
                <div class="custom_home_menu_grid">
                  ${appCards}
                </div>
              </div>
            </div>
        `;
    },

    attachOverlayEventListeners(container) {
        const appCards = container.querySelectorAll(".custom_home_menu_app_card");
        appCards.forEach((card) => {
            card.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const appId = parseInt(card.dataset.appId);
                const app = this.menuService.getApps().find((a) => a.id === appId);
                if (app) {
                    this.onAppClick(e, app);
                }
            });
        });
    }
});
