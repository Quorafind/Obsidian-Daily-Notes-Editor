import DailyNoteViewPlugin from "./dailyNoteViewIndex";
import {
    WorkspaceLeaf,
    ItemView,
    Scope,
    TAbstractFile,
    TFile,
    Menu,
    Modal,
    App,
    ButtonComponent,
} from "obsidian";
import { TimeRange, TimeField } from "./types/time";
import DailyNoteEditorView from "./component/DailyNoteEditorView.svelte";
export const DAILY_NOTE_VIEW_TYPE = "daily-note-editor-view";

export function isEmebeddedLeaf(leaf: WorkspaceLeaf) {
    // Work around missing enhance.js API by checking match condition instead of looking up parent
    return (leaf as any).containerEl.matches(".dn-leaf-view");
}

export class DailyNoteView extends ItemView {
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

    getMode = () => {
        return "source";
    };

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
            return "calendar";
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

    saveCurrentSelectionAsPreset() {
        if (this.selectionMode !== "daily" && this.target) {
            // Check if this preset already exists
            const existingPresetIndex = this.plugin.settings.preset.findIndex(
                (p) => p.type === this.selectionMode && p.target === this.target
            );

            // If it doesn't exist, add it
            if (existingPresetIndex === -1) {
                this.plugin.settings.preset.push({
                    type: this.selectionMode,
                    target: this.target,
                });
                this.plugin.saveSettings();
            }
        }
    }

    getState(): Record<string, unknown> {
        const state = super.getState();

        return {
            ...state,
            selectionMode: this.selectionMode,
            target: this.target,
            timeField: this.timeField,
            selectedRange: this.selectedDaysRange,
            customRange: this.customRange,
        };
    }

    async setState(state: unknown, result?: any): Promise<void> {
        await super.setState(state, result);
        // Handle our custom state properties if they exist
        if (state && typeof state === "object" && !this.view) {
            const customState = state as {
                selectionMode?: "daily" | "folder" | "tag";
                target?: string;
                timeField?: TimeField;
                selectedRange?: TimeRange;
                customRange?: { start: Date; end: Date } | null;
            };

            if (customState.selectionMode)
                this.selectionMode = customState.selectionMode;
            if (customState.target) this.target = customState.target;
            if (customState.timeField) this.timeField = customState.timeField;
            if (customState.selectedRange)
                this.selectedDaysRange = customState.selectedRange;
            if (customState.customRange)
                this.customRange = customState.customRange;

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

            this.app.workspace.onLayoutReady(this.view.tick.bind(this));

            this.registerInterval(
                window.setInterval(async () => {
                    this.view.check();
                }, 1000 * 60 * 60)
            );
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

        this.addAction("clock", "Select time field", (e) => {
            const menu = new Menu();

            // Add time field selection options
            const addTimeFieldOption = (title: string, field: TimeField) => {
                menu.addItem((item) => {
                    item.setTitle(title);
                    item.setChecked(this.timeField === field);
                    item.onClick(() => {
                        this.setTimeField(field);
                    });
                });
            };

            addTimeFieldOption("Creation Time", "ctime");
            addTimeFieldOption("Modification Time", "mtime");
            addTimeFieldOption("Creation Time (Reverse)", "ctimeReverse");
            addTimeFieldOption("Modification Time (Reverse)", "mtimeReverse");
            // Add new options for sorting by name
            addTimeFieldOption("Name (A-Z)", "name");
            addTimeFieldOption("Name (Z-A)", "nameReverse");

            menu.showAtMouseEvent(e);
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
                    item.setChecked(
                        this.selectionMode === mode && !this.target
                    );
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
                                    // Save this selection as a preset
                                    this.saveCurrentSelectionAsPreset();
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

            // Add presets if they exist
            if (this.plugin.settings.preset.length > 0) {
                menu.addSeparator();
                menu.addItem((item) => {
                    item.setTitle("Saved Presets");
                    item.setDisabled(true);
                });

                // Add each preset
                for (const preset of this.plugin.settings.preset) {
                    const title =
                        preset.type === "folder"
                            ? `Folder: ${preset.target}`
                            : `Tag: ${preset.target}`;

                    menu.addItem((item) => {
                        item.setTitle(title);
                        item.setChecked(
                            this.selectionMode === preset.type &&
                                this.target === preset.target
                        );
                        item.onClick(() => {
                            this.setSelectionMode(preset.type, preset.target);
                        });
                    });
                }
            }

            menu.showAtMouseEvent(e);
        });

        // Add "Save as Preset" button when in folder or tag mode
        // this.addAction("bookmark", "Save as preset", (e) => {
        //     // Only enable for folder and tag modes with a target
        //     if (this.selectionMode !== "daily" && this.target) {
        //         this.saveCurrentSelectionAsPreset();
        //         // Show a small notification
        //         new Notice("Preset saved");
        //     }
        // });

        // Add action for selecting time field (for folder and tag modes)

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

        this.app.vault.on("create", this.onFileCreate);
        this.app.vault.on("delete", this.onFileDelete);
    }

    onPaneMenu(
        menu: Menu,
        source: "more-options" | "tab-header" | string
    ): void {
        if (source === "tab-header" || source === "more-options") {
            menu.addItem((item) => {
                // @ts-ignore
                item.setIcon(this.leaf.pinned ? "pin-off" : "pin");
                // @ts-ignore
                item.setTitle(this.leaf.pinned ? "Unpin" : "Pin");
                item.onClick(() => {
                    this.leaf.togglePinned();
                });
            });
        }
    }

    /**
     * Refresh the view for a new day
     * This is called when the date changes (e.g., after midnight)
     */
    public refreshForNewDay(): void {
        // If we're in daily note mode, we need to refresh the view
        // to show the current day's note
        if (this.selectionMode === "daily") {
            // Reset the view properties to trigger a reload
            if (this.view) {
                // Tell the Svelte component to check for daily notes
                this.view.check();

                // Update the view to get the latest files
                this.view.tick();

                // Force a refresh of the file list
                this.view.$set({
                    selectedRange: this.selectedDaysRange,
                    customRange: this.customRange,
                });
            }
        }
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
