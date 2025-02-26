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
    moment,
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
import { TimeRange, TimeField } from "./types/time";
import {
    getAllDailyNotes,
    getDailyNote,
    createDailyNote,
} from "obsidian-daily-notes-interface";
import { createUpDownNavigationExtension } from "./component/UpAndDownNavigate";

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
    selectionMode: "daily" | "folder" | "tag" = "daily";
    target: string = "";
    timeField: TimeField = "mtime";

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
        if (this.selectionMode === "daily") {
            return "Daily Notes";
        } else if (this.selectionMode === "folder") {
            return `Folder: ${this.target}`;
        } else if (this.selectionMode === "tag") {
            return `Tag: ${this.target}`;
        }
        return "Notes";
    }

    getIcon(): string {
        if (this.selectionMode === "daily") {
            return "daily-note";
        } else if (this.selectionMode === "folder") {
            return "folder";
        } else if (this.selectionMode === "tag") {
            return "tag";
        }
        return "document";
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

    setSelectionMode(mode: "daily" | "folder" | "tag", target: string = "") {
        this.selectionMode = mode;
        this.target = target;

        if (this.view) {
            this.view.$set({
                selectionMode: mode,
                target: target,
            });
        }
    }

    setTimeField(field: TimeField) {
        this.timeField = field;
        if (this.view) {
            this.view.$set({ timeField: field });
        }
    }

    openDailyNoteEditor() {
        this.plugin.openDailyNoteEditor();
    }

    async onOpen(): Promise<void> {
        this.scope.register(["Mod"], "f", (e) => {
            // do-nothing
        });

        // Add action for selecting view mode
        this.addAction("layers-2", "Select view mode", (e) => {
            const menu = new Menu();

            // Add mode selection options
            const addModeOption = (
                title: string,
                mode: "daily" | "folder" | "tag"
            ) => {
                menu.addItem((item) => {
                    item.setTitle(title);
                    item.setChecked(this.selectionMode === mode);
                    item.onClick(() => {
                        if (mode === "daily") {
                            this.setSelectionMode(mode);
                        } else {
                            // For folder and tag modes, we need to prompt for the target
                            const modal = new SelectTargetModal(
                                this.plugin.app,
                                mode,
                                (target: string) => {
                                    this.setSelectionMode(mode, target);
                                }
                            );
                            modal.open();
                        }
                    });
                });
            };

            addModeOption("Daily Notes", "daily");
            addModeOption("Folder", "folder");
            addModeOption("Tag", "tag");

            menu.showAtMouseEvent(e);
        });

        // Add action for selecting time field (for folder and tag modes)
        this.addAction("clock", "Select time field", (e) => {
            const menu = new Menu();

            // Add time field selection options
            const addTimeFieldOption = (title: string, field: TimeField) => {
                menu.addItem((item) => {
                    item.setTitle(title);
                    item.setChecked(this.timeField === field);
                    item.setDisabled(this.selectionMode === "daily");
                    item.onClick(() => {
                        this.setTimeField(field);
                    });
                });
            };

            addTimeFieldOption("Creation Time", "ctime");
            addTimeFieldOption("Modification Time", "mtime");
            addTimeFieldOption("Creation Time (Reverse)", "ctimeReverse");
            addTimeFieldOption("Modification Time (Reverse)", "mtimeReverse");

            menu.showAtMouseEvent(e);
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
                selectionMode: this.selectionMode,
                target: this.target,
                timeField: this.timeField,
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

class SelectTargetModal extends Modal {
    saveCallback: (target: string) => void;
    mode: "folder" | "tag";
    targetInput: HTMLInputElement;

    constructor(
        app: App,
        mode: "folder" | "tag",
        saveCallback: (target: string) => void
    ) {
        super(app);
        this.mode = mode;
        this.saveCallback = saveCallback;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", {
            text: this.mode === "folder" ? "Select Folder" : "Select Tag",
        });

        const form = contentEl.createEl("form");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            this.save();
        });

        const targetSetting = form.createDiv();
        targetSetting.addClass("setting-item");

        const targetSettingInfo = targetSetting.createDiv();
        targetSettingInfo.addClass("setting-item-info");

        targetSettingInfo.createEl("div", {
            text: this.mode === "folder" ? "Folder Path" : "Tag Name",
            cls: "setting-item-name",
        });

        targetSettingInfo.createEl("div", {
            text:
                this.mode === "folder"
                    ? "Enter the path to the folder (e.g., 'folder/subfolder')"
                    : "Enter the tag name without the '#' (e.g., 'tag')",
            cls: "setting-item-description",
        });

        const targetSettingControl = targetSetting.createDiv();
        targetSettingControl.addClass("setting-item-control");

        this.targetInput = targetSettingControl.createEl("input", {
            type: "text",
            value: "",
        });
        this.targetInput.addClass("target-input");

        const footerEl = contentEl.createDiv();
        footerEl.addClass("modal-button-container");

        footerEl
            .createEl("button", {
                text: "Cancel",
                cls: "mod-warning",
                attr: {
                    type: "button",
                },
            })
            .addEventListener("click", () => {
                this.close();
            });

        footerEl
            .createEl("button", {
                text: "Save",
                cls: "mod-cta",
                attr: {
                    type: "submit",
                },
            })
            .addEventListener("click", (e) => {
                e.preventDefault();
                this.save();
            });
    }

    save() {
        const target = this.targetInput.value.trim();
        if (target) {
            this.saveCallback(target);
            this.close();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
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

        // Register the up and down navigation extension
        this.registerEditorExtension([
            createUpDownNavigationExtension({ app: this.app, plugin: this }),
        ]);

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

        // Create daily note and open the Daily Notes Editor on startup if enabled
        if (this.settings.createAndOpenOnStartup) {
            this.app.workspace.onLayoutReady(async () => {
                // First ensure today's daily note exists
                await this.ensureTodaysDailyNoteExists();
                // Then open the Daily Notes Editor
                await this.openDailyNoteEditor();
            });
        }
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

    async openFolderView(folderPath: string, timeField: TimeField = "mtime") {
        const workspace = this.app.workspace;
        const leaf = workspace.getLeaf(true);
        await leaf.setViewState({ type: DAILY_NOTE_VIEW_TYPE });

        // Get the view and set the selection mode to folder
        const view = leaf.view as DailyNoteView;
        view.setSelectionMode("folder", folderPath);
        view.setTimeField(timeField);

        workspace.revealLeaf(leaf);
    }

    async openTagView(tagName: string, timeField: TimeField = "mtime") {
        const workspace = this.app.workspace;
        const leaf = workspace.getLeaf(true);
        await leaf.setViewState({ type: DAILY_NOTE_VIEW_TYPE });

        // Get the view and set the selection mode to tag
        const view = leaf.view as DailyNoteView;
        view.setSelectionMode("tag", tagName);
        view.setTimeField(timeField);

        workspace.revealLeaf(leaf);
    }

    async ensureTodaysDailyNoteExists() {
        try {
            const currentDate = moment();
            const allDailyNotes = getAllDailyNotes();
            const currentDailyNote = getDailyNote(currentDate, allDailyNotes);

            if (!currentDailyNote) {
                await createDailyNote(currentDate);
            }
        } catch (error) {
            console.error("Failed to create daily note:", error);
        }
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
                        parent === this.app.workspace.rootSplit ||
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
