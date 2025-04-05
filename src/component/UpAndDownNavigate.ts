import {
    App,
    Editor,
    editorInfoField,
    EditorPosition,
    MarkdownView,
    TFile,
    WorkspaceLeaf,
} from "obsidian";
import { EditorView, KeyBinding, keymap } from "@codemirror/view";
import { Extension, Prec } from "@codemirror/state";
import { isDailyNoteLeaf } from "../leafView";
import DailyNoteViewPlugin from "src/dailyNoteViewIndex";

export interface UpAndDownNavigateOptions {
    app: App;
    plugin: DailyNoteViewPlugin;
}

/**
 * Get the current editor from a leaf
 */
function getEditor(leaf: WorkspaceLeaf): Editor | null {
    if (!leaf) return null;

    const view = leaf.view;
    if (!(view instanceof MarkdownView)) return null;

    return view.editor;
}

/**
 * Get the CodeMirror editor instance from a leaf
 */
export function getEditorView(leaf: WorkspaceLeaf): EditorView | null {
    if (!leaf) return null;

    const view = leaf.view;
    if (!(view instanceof MarkdownView)) return null;

    // Access the CodeMirror editor instance
    // @ts-ignore - Accessing private property
    return view.editor.cm;
}

/**
 * Find the next or previous leaf in the daily notes view
 * @param app The Obsidian app instance
 * @param currentLeaf The current leaf
 * @param direction 'up' or 'down'
 * @returns The next or previous leaf, or null if not found
 */
function findAdjacentLeaf(
    app: App,
    currentLeaf: WorkspaceLeaf,
    direction: "up" | "down"
): WorkspaceLeaf | null {
    if (!currentLeaf || !isDailyNoteLeaf(currentLeaf)) return null;

    // Get all daily note leaves
    const dailyNoteLeaves: WorkspaceLeaf[] = [];

    app.workspace.iterateAllLeaves((leaf) => {
        if (isDailyNoteLeaf(leaf)) {
            dailyNoteLeaves.push(leaf);
        }
    });

    // Sort leaves by their position in the DOM
    dailyNoteLeaves.sort((a, b) => {
        const rectA = a.containerEl.getBoundingClientRect();
        const rectB = b.containerEl.getBoundingClientRect();
        return rectA.top - rectB.top;
    });

    // Find the current leaf index
    const currentIndex = dailyNoteLeaves.findIndex(
        (leaf) => leaf === currentLeaf
    );
    if (currentIndex === -1) return null;

    // Get the next or previous leaf
    const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;

    // Return the target leaf if it exists
    return targetIndex >= 0 && targetIndex < dailyNoteLeaves.length
        ? dailyNoteLeaves[targetIndex]
        : null;
}

/**
 * Navigate to the adjacent leaf and focus its editor
 */
function navigateToAdjacentLeaf(
    app: App,
    currentLeaf: WorkspaceLeaf,
    direction: "up" | "down"
): boolean {
    const targetLeaf = findAdjacentLeaf(app, currentLeaf, direction);
    if (!targetLeaf) return false;

    // Focus the target leaf
    app.workspace.setActiveLeaf(targetLeaf, { focus: true });

    // Get the editor
    const editor = getEditor(targetLeaf);
    if (!editor) return false;

    // Set cursor position based on direction
    let pos: EditorPosition;

    if (direction === "up") {
        // If navigating up, place cursor at the bottom of the document
        const lastLine = editor.lastLine();
        const lastLineLength = editor.getLine(lastLine).length;
        pos = { line: lastLine, ch: lastLineLength };
    } else {
        // If navigating down, place cursor at the top of the document
        pos = { line: 0, ch: 0 };
    }

    // Set cursor position
    editor.setCursor(pos);

    // Ensure the cursor is visible by scrolling to it
    editor.scrollIntoView(
        {
            from: pos,
            to: pos,
        },
        true
    );

    // Focus the editor
    setTimeout(() => {
        // Try different methods to ensure focus
        if (targetLeaf.view instanceof MarkdownView) {
            // @ts-ignore - Accessing private property
            if (targetLeaf.view.editMode && targetLeaf.view.editMode.editor) {
                // @ts-ignore - Accessing private property
                targetLeaf.view.editMode.editor.focus();
            } else {
                editor.focus();
            }
        }
    }, 10);

    return true;
}

/**
 * Check if frontmatter is hidden in the current view
 */
function isFrontmatterHidden(plugin: DailyNoteViewPlugin): boolean {
    // @ts-ignore - Accessing settings property
    return plugin.settings?.hideFrontmatter === true;
}

/**
 * Check if the current position is at the first visible line when frontmatter is hidden
 */
function isAtFirstVisibleLine(
    view: EditorView,
    file: TFile,
    app: App,
    plugin: DailyNoteViewPlugin
): boolean {
    // If frontmatter is not hidden, just check if we're at line 1
    if (!isFrontmatterHidden(plugin)) {
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        return line.number === 1 && pos === line.from;
    }

    // If frontmatter is hidden, we need to check if we're at the first line after frontmatter
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);

    // Get the file's metadata cache to check frontmatter
    const fileCache = app.metadataCache.getFileCache(file);

    // If there's no frontmatter or we can't detect it, fall back to line 1
    if (!fileCache || !fileCache.frontmatter) {
        return line.number === 1 && pos === line.from;
    }

    // Get the end line of the frontmatter section
    const frontmatterEndLine =
        (fileCache.frontmatterPosition?.end?.line ?? 0) + 2;

    // Check if we're at the first line after frontmatter and at the beginning of that line
    return line.number === frontmatterEndLine && pos === line.from;
}

/**
 * Create the up and down navigation extension for CodeMirror
 */
export function createUpDownNavigationExtension(
    options: UpAndDownNavigateOptions
): Extension {
    const { app, plugin } = options;

    // Define key bindings
    const keyBindings: KeyBinding[] = [
        {
            key: "ArrowUp",
            run: (view) => {
                if (!view.state) return false;
                // @ts-ignore
                const infoView = view.state.field(editorInfoField);

                // Get the current file
                // @ts-ignore
                const currentLeaf = infoView?.leaf;
                const currentFile = currentLeaf?.view?.file;

                // Check if we're at the first visible line (considering frontmatter)
                if (
                    currentFile &&
                    isAtFirstVisibleLine(view, currentFile, app, plugin)
                ) {
                    if (
                        currentLeaf &&
                        navigateToAdjacentLeaf(app, currentLeaf, "up")
                    ) {
                        return true;
                    }
                }

                // Let the default handler process the key
                return false;
            },
        },
        {
            key: "ArrowDown",
            run: (view) => {
                if (!view.state) return false;
                // Get the current cursor position
                const pos = view.state.selection.main.head;
                const line = view.state.doc.lineAt(pos);

                // @ts-ignore
                const infoView = view.state.field(editorInfoField);

                // Get the current file
                // @ts-ignore
                const currentLeaf = infoView?.leaf;

                // If cursor is at the last line and at the end of the line
                const lastLineNumber = view.state.doc.lines;
                if (line.number === lastLineNumber && pos === line.to) {
                    if (
                        currentLeaf &&
                        navigateToAdjacentLeaf(app, currentLeaf, "down")
                    ) {
                        return true;
                    }
                }

                // Let the default handler process the key
                return false;
            },
        },
    ];

    return Prec.highest(keymap.of(keyBindings));
}
