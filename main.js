const { Notice, Platform, Plugin, setIcon } = require("obsidian");

const BORDER_THEME = "Border";
const THEME_CLASS = "border-theme-compacted-theme";
const MAC_WINDOW_BUTTON_Y = 12;

module.exports = class BorderThemeCompactedPlugin extends Plugin {
  onload() {
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.classList.add("border-theme-compacted-status");
    this.statusBarItem.setAttribute("role", "button");
    this.statusBarItem.setAttribute("tabindex", "0");
    this.statusBarItem.setAttribute(
      "aria-label",
      "左键：显示功能区菜单；右键：切换原 ribbon",
    );
    this.statusBarItem.setAttribute("data-tooltip-position", "top");
    setIcon(this.statusBarItem, "panel-left-open");

    this.registerDomEvent(this.statusBarItem, "click", (event) => {
      event.stopPropagation();
      this.toggleRibbonMenu();
    });

    this.registerDomEvent(this.statusBarItem, "keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      this.toggleRibbonMenu();
    });

    this.registerDomEvent(this.statusBarItem, "contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleOriginalRibbon();
    });

    this.registerDomEvent(document, "pointerdown", (event) => {
      if (!this.menuEl) return;
      if (this.menuEl.contains(event.target)) return;
      if (this.statusBarItem.contains(event.target)) return;
      this.closeRibbonMenu();
    });

    this.registerDomEvent(document, "keydown", (event) => {
      if (event.key === "Escape") this.closeRibbonMenu();
    });

    this.updateThemeState();
    this.registerEvent(this.app.workspace.on("css-change", () => this.updateThemeState()));
  }

  onunload() {
    this.closeRibbonMenu();
    this.restoreMacWindowButtons();
    document.body.classList.remove(THEME_CLASS);
  }

  isBorderTheme() {
    return this.app.customCss?.theme === BORDER_THEME;
  }

  updateThemeState() {
    const isBorder = this.isBorderTheme();
    document.body.classList.toggle(THEME_CLASS, isBorder);
    if (isBorder) {
      this.alignMacWindowButtons();
    } else {
      this.closeRibbonMenu();
      this.restoreMacWindowButtons();
    }
  }

  getMacWindow() {
    if (!Platform.isMacOS) return null;

    try {
      return require("electron").remote?.getCurrentWindow?.() ?? null;
    } catch {
      return null;
    }
  }

  alignMacWindowButtons() {
    const currentWindow = this.getMacWindow();
    if (!currentWindow?.getWindowButtonPosition || !currentWindow?.setWindowButtonPosition) {
      return;
    }

    const position = currentWindow.getWindowButtonPosition();
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return;

    if (this.originalMacWindowButtonY == null) {
      this.originalMacWindowButtonY = position.y;
    }

    if (position.y !== MAC_WINDOW_BUTTON_Y) {
      currentWindow.setWindowButtonPosition({ x: position.x, y: MAC_WINDOW_BUTTON_Y });
    }
  }

  restoreMacWindowButtons() {
    if (this.originalMacWindowButtonY == null) return;

    const currentWindow = this.getMacWindow();
    const position = currentWindow?.getWindowButtonPosition?.();
    if (position && Number.isFinite(position.x)) {
      currentWindow.setWindowButtonPosition({
        x: position.x,
        y: this.originalMacWindowButtonY,
      });
    }
  }

  getVisibleRibbonItems() {
    const items = this.app.workspace.leftRibbon?.items ?? [];
    return items.filter((item) => item && item.hidden !== true && item.title);
  }

  executeRibbonItem(item) {
    if (item.id && this.app.commands.findCommand(item.id)) {
      this.app.commands.executeCommandById(item.id);
      return;
    }

    if (item.buttonEl && typeof item.buttonEl.click === "function") {
      item.buttonEl.click();
      return;
    }

    new Notice(`无法执行功能区项目：${item.title}`);
  }

  toggleRibbonMenu() {
    if (this.menuEl) {
      this.closeRibbonMenu();
      return;
    }

    if (!this.isBorderTheme()) return;
    this.openRibbonMenu();
  }

  toggleOriginalRibbon() {
    this.closeRibbonMenu();
    if (!this.isBorderTheme()) return;
    this.app.commands.executeCommandById("app:toggle-ribbon");
  }

  openRibbonMenu() {
    this.closeRibbonMenu();

    const menu = document.body.createDiv({
      cls: "border-theme-compacted-popover",
      attr: {
        role: "menu",
        "aria-label": "左侧功能区",
      },
    });

    const items = this.getVisibleRibbonItems();
    if (items.length === 0) {
      menu.createDiv({
        cls: "border-theme-compacted-empty",
        text: "没有可用的功能区项目",
      });
    } else {
      for (const ribbonItem of items) {
        const button = menu.createEl("button", {
          cls: "border-theme-compacted-item",
          attr: {
            type: "button",
            role: "menuitem",
          },
        });

        const icon = button.createSpan({ cls: "border-theme-compacted-item-icon" });
        setIcon(icon, ribbonItem.icon || "command");

        button.createSpan({
          cls: "border-theme-compacted-item-title",
          text: ribbonItem.title,
        });

        button.addEventListener("click", () => {
          this.closeRibbonMenu();
          this.executeRibbonItem(ribbonItem);
        });
      }
    }

    this.menuEl = menu;
    menu.querySelector("button")?.focus();
  }

  closeRibbonMenu() {
    this.menuEl?.remove();
    this.menuEl = null;
  }
};
