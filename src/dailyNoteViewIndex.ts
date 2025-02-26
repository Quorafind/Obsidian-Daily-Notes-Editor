import {
    ItemView,
    Plugin,
    OpenViewState,
    TFile,
    Workspace,
    WorkspaceContainer,
    WorkspaceItem,
    WorkspaceLeaf,
    TAbstractFile,
    Scope,
    Menu,
    Modal,
    App,
    ButtonComponent,
} from "obsidian";
import DailyNoteEditorView from "./component/DailyNoteEditorView.svelte";
import { around } from "monkey-around";
import { DailyNoteEditor, isDailyNoteLeaf } from "./leafView";
import "./style/index.css";
import { addIconList } from "./utils/icon";
import {
    DailyNoteSettings,
    DailyNoteSettingTab,
    DEFAULT_SETTINGS,
} from "./dailyNoteSettings";
import { TimeRange } from "./types/time";
export const DAILY_NOTE_VIEW_TYPE = "daily-note-editor-view";

export function isEmebeddedLeaf(leaf: WorkspaceLeaf) {
    // Work around missing enhance.js API by checking match condition instead of looking up parent
    return (leaf as any).containerEl.matches(".dn-leaf-view");
}

class DailyNoteView extends ItemView {
    view: DailyNoteEditorView;
    plugin: DailyNoteViewPlugin;
    scope: Scope;

    selectedDaysRange: TimeRange = "all";

    customRange: {
        start: Date;
        end: Date;
    } | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: DailyNoteViewPlugin) {
        super(leaf);
        this.plugin = plugin;

        this.scope = new Scope(plugin.app.scope);
    }

    getViewType(): string {
        return DAILY_NOTE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Daily Note";
    }

    getIcon(): string {
        return "daily-note";
    }

    onFileCreate = (file: TAbstractFile) => {
        if (file instanceof TFile) this.view.fileCreate(file);
    };

    onFileDelete = (file: TAbstractFile) => {
        if (file instanceof TFile) this.view.fileDelete(file);
    };

    setSelectedRange(range: TimeRange) {
        this.selectedDaysRange = range;
        if (this.view) {
            if (range === "custom") {
                this.view.$set({
                    selectedRange: range,
                    customRange: this.customRange,
                });
            } else {
                this.view.$set({ selectedRange: range });
            }
        }
    }

    openDailyNoteEditor() {
        this.plugin.openDailyNoteEditor();
    }

    async onOpen(): Promise<void> {
        this.scope.register(["Mod"], "f", (e) => {
            // do-nothing
        });
        this.addAction("calendar-range", "Select date range", (e) => {
            const menu = new Menu();
            // Add range selection options
            const addRangeOption = (title: string, range: TimeRange) => {
                menu.addItem((item) => {
                    item.setTitle(title);
                    item.setChecked(this.selectedDaysRange === range);
                    item.onClick(() => {
                        this.setSelectedRange(range);
                    });
                });
            };

            addRangeOption("All Notes", "all");
            addRangeOption("This Week", "week");
            addRangeOption("This Month", "month");
            addRangeOption("This Year", "year");
            addRangeOption("Last Week", "last-week");
            addRangeOption("Last Month", "last-month");
            addRangeOption("Last Year", "last-year");
            addRangeOption("This Quarter", "quarter");
            addRangeOption("Last Quarter", "last-quarter");

            menu.addSeparator();
            menu.addItem((item) => {
                item.setTitle("Custom Date Range");
                item.setChecked(this.selectedDaysRange === "custom");
                item.onClick(() => {
                    const modal = new CustomRangeModal(this.app, (range) => {
                        this.customRange = range;
                        this.setSelectedRange("custom");
                    });
                    modal.open();
                });
            });

            menu.showAtMouseEvent(e as MouseEvent);
        });

        this.view = new DailyNoteEditorView({
            target: this.contentEl,
            props: {
                plugin: this.plugin,
                leaf: this.leaf,
                selectedRange: this.selectedDaysRange,
                customRange: this.customRange,
            },
        });
        this.app.vault.on("create", this.onFileCreate);
        this.app.vault.on("delete", this.onFileDelete);
        this.app.workspace.onLayoutReady(this.view.tick.bind(this));

        // used for triggering when the day change
        this.registerInterval(
            window.setInterval(async () => {
                this.view.check();
            }, 1000 * 60 * 60)
        );
    }
}

class CustomRangeModal extends Modal {
    saveCallback: (range: { start: Date; end: Date }) => void;
    startDate: Date;
    endDate: Date;

    constructor(
        app: App,
        saveCallback: (range: { start: Date; end: Date }) => void
    ) {
        super(app);
        this.saveCallback = saveCallback;
        this.startDate = new Date();
        this.endDate = new Date();
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: "Select Custom Date Range" });

        const startDateContainer = contentEl.createEl("div", {
            cls: "custom-range-date-container",
        });
        startDateContainer.createEl("span", { text: "Start Date: " });
        const startDatePicker = startDateContainer.createEl("input", {
            type: "date",
            value: this.formatDate(this.startDate),
        });
        startDatePicker.addEventListener("change", (e) => {
            this.startDate = new Date((e.target as HTMLInputElement).value);
        });

        const endDateContainer = contentEl.createEl("div", {
            cls: "custom-range-date-container",
        });
        endDateContainer.createEl("span", { text: "End Date: " });
        const endDatePicker = endDateContainer.createEl("input", {
            type: "date",
            value: this.formatDate(this.endDate),
        });
        endDatePicker.addEventListener("change", (e) => {
            this.endDate = new Date((e.target as HTMLInputElement).value);
        });

        const buttonContainer = contentEl.createEl("div", {
            cls: "custom-range-button-container",
        });

        new ButtonComponent(buttonContainer)
            .setButtonText("Cancel")
            .onClick(() => {
                this.close();
            });

        new ButtonComponent(buttonContainer)
            .setButtonText("Confirm")
            .setCta()
            .onClick(() => {
                this.saveCallback({
                    start: this.startDate,
                    end: this.endDate,
                });
                this.close();
            });
    }

    formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    onClose() {
        this.contentEl.empty();
    }
}

export default class DailyNoteViewPlugin extends Plugin {
    private view: DailyNoteView;
    lastActiveFile: TFile;

    settings: DailyNoteSettings;

    async onload() {
        this.addSettingTab(new DailyNoteSettingTab(this.app, this));
        await this.loadSettings();
        this.patchWorkspace();
        this.patchWorkspaceLeaf();
        addIconList();

        this.registerView(
            DAILY_NOTE_VIEW_TYPE,
            (leaf: WorkspaceLeaf) => (this.view = new DailyNoteView(leaf, this))
        );

        this.addRibbonIcon(
            "calendar-range",
            "Open Daily Note Editor",
            (evt: MouseEvent) => this.openDailyNoteEditor()
        );
        this.addCommand({
            id: "open-daily-note-editor",
            name: "Open Daily Note Editor",
            callback: () => this.openDailyNoteEditor(),
        });

        this.initCssRules();
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(DAILY_NOTE_VIEW_TYPE);
        document.body.toggleClass("daily-notes-hide-frontmatter", false);
        document.body.toggleClass("daily-notes-hide-backlinks", false);
    }

    async openDailyNoteEditor() {
        const workspace = this.app.workspace;
        workspace.detachLeavesOfType(DAILY_NOTE_VIEW_TYPE);
        const leaf = workspace.getLeaf(true);
        await leaf.setViewState({ type: DAILY_NOTE_VIEW_TYPE });
        workspace.revealLeaf(leaf);
    }

    initCssRules() {
        document.body.toggleClass(
            "daily-notes-hide-frontmatter",
            this.settings.hideFrontmatter
        );
        document.body.toggleClass(
            "daily-notes-hide-backlinks",
            this.settings.hideBacklinks
        );
    }

    patchWorkspace() {
        let layoutChanging = false;
        const uninstaller = around(Workspace.prototype, {
            changeLayout(old) {
                return async function (workspace: unknown) {
                    layoutChanging = true;
                    try {
                        // Don't consider hover popovers part of the workspace while it's changing
                        await old.call(this, workspace);
                    } finally {
                        layoutChanging = false;
                    }
                };
            },
            iterateLeaves(old) {
                type leafIterator = (item: WorkspaceLeaf) => boolean | void;
                return function (arg1, arg2) {
                    // Fast exit if desired leaf found
                    if (old.call(this, arg1, arg2)) return true;

                    // Handle old/new API parameter swap
                    const cb: leafIterator = (
                        typeof arg1 === "function" ? arg1 : arg2
                    ) as leafIterator;
                    const parent: WorkspaceItem = (
                        typeof arg1 === "function" ? arg2 : arg1
                    ) as WorkspaceItem;

                    if (!parent) return false; // <- during app startup, rootSplit can be null
                    if (layoutChanging) return false; // Don't let HEs close during workspace change

                    // 0.14.x doesn't have WorkspaceContainer; this can just be an instanceof check once 15.x is mandatory:
                    if (
                        parent === app.workspace.rootSplit ||
                        (WorkspaceContainer &&
                            parent instanceof WorkspaceContainer)
                    ) {
                        for (const popover of DailyNoteEditor.popoversForWindow(
                            (parent as WorkspaceContainer).win
                        )) {
                            // Use old API here for compat w/0.14.x
                            if (old.call(this, cb, popover.rootSplit))
                                return true;
                        }
                    }
                    return false;
                };
            },
            setActiveLeaf: (next: any) =>
                function (e: WorkspaceLeaf, t?: any) {
                    if ((e as any).parentLeaf) {
                        (e as any).parentLeaf.activeTime = 1700000000000;

                        next.call(this, (e as any).parentLeaf, t);
                        if ((e.view as any).editMode) {
                            this.activeEditor = e.view;
                        }
                        return;
                    }
                    next.call(this, e, t);
                },
            onDragLeaf(old) {
                return function (event: MouseEvent, leaf: WorkspaceLeaf) {
                    // const hoverPopover = DailyNoteEditor.forLeaf(leaf);
                    return old.call(this, event, leaf);
                };
            },
        });
        this.register(uninstaller);
    }

    // Used for patch workspaceleaf pinned behaviors
    patchWorkspaceLeaf() {
        this.register(
            around(WorkspaceLeaf.prototype, {
                getRoot(old) {
                    return function () {
                        const top = old.call(this);
                        return top?.getRoot === this.getRoot
                            ? top
                            : top?.getRoot();
                    };
                },
                setPinned(old) {
                    return function (pinned: boolean) {
                        old.call(this, pinned);
                        if (isDailyNoteLeaf(this) && !pinned)
                            this.setPinned(true);
                    };
                },
                openFile(old) {
                    return function (file: TFile, openState?: OpenViewState) {
                        if (isDailyNoteLeaf(this)) {
                            setTimeout(
                                around(Workspace.prototype, {
                                    recordMostRecentOpenedFile(old) {
                                        return function (_file: TFile) {
                                            // Don't update the quick switcher's recent list
                                            if (_file !== file) {
                                                return old.call(this, _file);
                                            }
                                        };
                                    },
                                }),
                                1
                            );
                            const recentFiles =
                                this.app.plugins.plugins[
                                    "recent-files-obsidian"
                                ];
                            if (recentFiles)
                                setTimeout(
                                    around(recentFiles, {
                                        shouldAddFile(old) {
                                            return function (_file: TFile) {
                                                // Don't update the Recent Files plugin
                                                return (
                                                    _file !== file &&
                                                    old.call(this, _file)
                                                );
                                            };
                                        },
                                    }),
                                    1
                                );
                        }
                        return old.call(this, file, openState);
                    };
                },
            })
        );
    }

    public async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
