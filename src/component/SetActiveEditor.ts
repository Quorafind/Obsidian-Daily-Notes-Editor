import { EditorView } from "@codemirror/view";
import { StateEffect, EditorState } from "@codemirror/state";
import { App, editorInfoField, Editor } from "obsidian";

/**
 * CodeMirror extension that updates the active editor whenever an editor is selected
 * This is used to ensure the correct editor is active for commands and other operations
 *
 * @param app - The Obsidian app instance
 * @returns A CodeMirror extension that handles editor selection
 */
export const setActiveEditorExt = (app: App) => {
    // Track the last focus state to avoid triggering multiple times
    let lastFocusState = false;

    return EditorView.domEventHandlers({
        // When the editor receives focus
        focus: (event, view) => {
            if (!lastFocusState) {
                lastFocusState = true;

                // Get the editor info from the state using type assertion to handle version mismatches
                const editorInfo = view.state.field(editorInfoField as any)

                console.log(editorInfo);

                // Update the active editor in the app
                if (editorInfo) {
                    // Set the current editor as the active editor
                    // Using any type to bypass the type checking issues
                    (app.workspace as any).activeEditor = editorInfo;
                }
            }
        },
    });
};
