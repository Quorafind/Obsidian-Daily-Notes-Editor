import {
    App,
    ItemView,
    Plugin, OpenViewState,
    PluginSettingTab,
    Setting, TFile,
    Workspace,
    WorkspaceContainer, WorkspaceItem,
    WorkspaceLeaf, addIcon, TAbstractFile
} from 'obsidian';
import DailyNoteEditorView from "./component/DailyNoteEditorView.svelte";
import { around } from "monkey-around";
import { DailyNoteEditor, isDailyNoteLeaf } from "./leafView";
import "./style/index.css";
import { addIconList } from "./utils/icon";

export const DAILY_NOTE_VIEW_TYPE = "daily-note-editor-view";

class DailyNoteView extends ItemView {
    view: DailyNoteEditorView;
    plugin: DailyNoteViewPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: DailyNoteViewPlugin) {
        super(leaf);
        this.plugin = plugin;
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

    onFileCreate = (file: TAbstractFile)=> {
        if(file instanceof TFile) this.view.fileCreate(file);
    }

    onFileDelete = (file: TAbstractFile)=> {
        if(file instanceof TFile) this.view.fileDelete(file);
    };

    async onOpen(): Promise<void> {

        this.view = new DailyNoteEditorView({ target: this.contentEl, props: { plugin: this.plugin , leaf: this.leaf} });
        this.app.vault.on("create", this.onFileCreate);
        this.app.vault.on("delete", this.onFileDelete);
        this.app.workspace.onLayoutReady(this.view.tick.bind(this));

        this.registerInterval(window.setInterval(async () => {
            this.view.check();
        }, 1000 * 60 * 60 * 24));
    }
}

export default class DailyNoteViewPlugin extends Plugin {
    private view: DailyNoteView;
    lastActiveFile: TFile;

    async onload() {
        this.patchWorkspace();
        this.patchWorkspaceLeaf();
        addIconList();

        this.registerView(DAILY_NOTE_VIEW_TYPE, (leaf: WorkspaceLeaf) => (this.view = new DailyNoteView(leaf, this)));

        this.addRibbonIcon('daily-note', 'Open Daily Note Editor', (evt: MouseEvent) => this.openDailyNoteEditor());
        this.addCommand({
            id: 'open-daily-note-editor',
            name: 'Open Daily Note Editor',
            callback: () => this.openDailyNoteEditor(),
        });


    }

    onunload() {
        this.app.workspace.detachLeavesOfType(DAILY_NOTE_VIEW_TYPE);
    }

    async openDailyNoteEditor() {
        const workspace = this.app.workspace;
        workspace.detachLeavesOfType(DAILY_NOTE_VIEW_TYPE);
        const leaf = workspace.getLeaf(true);
        await leaf.setViewState({ type: DAILY_NOTE_VIEW_TYPE });
        workspace.revealLeaf(leaf);
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
                    const cb:     leafIterator  = (typeof arg1 === "function" ? arg1 : arg2) as leafIterator;
                    const parent: WorkspaceItem = (typeof arg1 === "function" ? arg2 : arg1) as WorkspaceItem;

                    if (!parent) return false;  // <- during app startup, rootSplit can be null
                    if (layoutChanging) return false;  // Don't let HEs close during workspace change

                    // 0.14.x doesn't have WorkspaceContainer; this can just be an instanceof check once 15.x is mandatory:
                    if (parent === app.workspace.rootSplit || (WorkspaceContainer && parent instanceof WorkspaceContainer)) {
                        for(const popover of DailyNoteEditor.popoversForWindow((parent as WorkspaceContainer).win)) {
                            // Use old API here for compat w/0.14.x
                            if (old.call(this, cb, popover.rootSplit)) return true;
                        }
                    }
                    return false;
                };
            },
            onDragLeaf(old) {
                return function (event: MouseEvent, leaf: WorkspaceLeaf) {
                    // const hoverPopover = DailyNoteEditor.forLeaf(leaf);
                    return old.call(this, event, leaf);
                };
            }
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
                        return top?.getRoot === this.getRoot ? top : top?.getRoot();
                    };
                },
                setPinned(old) {
                    return function (pinned: boolean) {
                        old.call(this, pinned);
                        if(isDailyNoteLeaf(this) && !pinned) this.setPinned(true);
                    }
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
                                1,
                            );
                            const recentFiles = this.app.plugins.plugins["recent-files-obsidian"];
                            if (recentFiles)
                                setTimeout(
                                    around(recentFiles, {
                                        shouldAddFile(old) {
                                            return function (_file: TFile) {
                                                // Don't update the Recent Files plugin
                                                return _file !== file && old.call(this, _file);
                                            };
                                        },
                                    }),
                                    1,
                                );
                        }
                        return old.call(this, file, openState);
                    }
                }
            }),
        );
    }
}
