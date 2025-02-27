import {
    Plugin,
    OpenViewState,
    TFile,
    Workspace,
    WorkspaceContainer,
    WorkspaceItem,
    WorkspaceLeaf,
    moment,
    requireApiVersion,
} from "obsidian";

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
// import { setActiveEditorExt } from "./component/SetActiveEditor";
import { DAILY_NOTE_VIEW_TYPE, DailyNoteView } from "./dailyNoteView";

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
            // setActiveEditorExt({ app: this.app, plugin: this }),
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
                if (
                    this.app.workspace.getLeavesOfType(DAILY_NOTE_VIEW_TYPE)
                        .length > 0
                )
                    return;
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
            getActiveViewOfType: (next: any) =>
                function (t: any) {
                    const result = next.call(this, t);
                    if (!result) {
                        if (t?.VIEW_TYPE === "markdown") {
                            const activeLeaf = this.activeLeaf;
                            if (activeLeaf?.view instanceof DailyNoteView) {
                                console.log(
                                    "getActiveViewOfType",
                                    activeLeaf.view.editMode
                                );
                                return activeLeaf.view.editMode;
                            } else {
                                return result;
                            }
                        }
                    }
                    return result;
                },
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
                    if (!requireApiVersion("0.15.0")) {
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
                    }
                    return false;
                };
            },
            setActiveLeaf: (next: any) =>
                function (e: WorkspaceLeaf, t?: any) {
                    if ((e as any).parentLeaf) {
                        console.log("setActiveLeaf", e, t);
                        (e as any).parentLeaf.activeTime = 1700000000000;

                        next.call(this, (e as any).parentLeaf, t);
                        if ((e.view as any).editMode) {
                            this.activeEditor = e.view;
                            (e as any).parentLeaf.view.editMode = e.view;
                        }
                        return;
                    }
                    return next.call(this, e, t);
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
                        console.log("openFile", file, openState, this);
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
