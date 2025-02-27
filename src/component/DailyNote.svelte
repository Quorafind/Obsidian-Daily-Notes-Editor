<script lang="ts">
    import type DailyNoteViewPlugin from "../dailyNoteViewIndex";
    import { TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
    import { spawnLeafView } from "../leafView";
    import { inview } from "svelte-inview";
    import { genId } from "../utils/utils";

    export let file: TAbstractFile;
    export let plugin: DailyNoteViewPlugin;
    export let leaf: WorkspaceLeaf;

    let editorEl: HTMLElement;
    let title: string;

    let rendered: boolean = false;
    let id: string;

    let createdLeaf: WorkspaceLeaf;
    // let dnEditor: DailyNoteEditor;

    $: if (editorEl) {
        showEditor();
        id = genId(8);
    }


    function showEditor() {
        if (!(file instanceof TFile)) return;
        if (rendered) return;

        title = file.basename;

        [createdLeaf] = spawnLeafView(plugin, editorEl, leaf);
        createdLeaf.setPinned(true);

        createdLeaf.openFile(file, {
            active: false,
            state: {mode: "source", backlinks: !plugin.settings.hideBacklinks,}
        })
        createdLeaf.parentLeaf = leaf;

        rendered = true;
    }

    function handleFileIconClick() {
        if (!(file instanceof TFile)) return;
        if (leaf) {
            leaf.openFile(file);
        } else plugin.app.workspace.getLeaf(false).openFile(file);
    }

    // function hideHandler(event: any) {
    //     console.log(event);
    //     const {scrollDirection} = event.detail;
    //     if (scrollDirection.vertical === "up") {
    //         rendered = false;
    //         dnEditor.hide();
    //     }
    // }

    function showHandler(event: any) {
        const {scrollDirection} = event.detail;
        if (scrollDirection.vertical === "down") {
            showEditor();
        }
    }

    function handleEditorClick() {
        // @ts-ignore
        const editor = createdLeaf.view.editMode?.editor;
        if (!editor.hasFocus()) {
            editor.focus();
        }
    }
</script>

<div class="daily-note-container" data-id='dn-editor-{id}'>
    <div class="daily-note">
        {#if title}
            <div class="daily-note-title inline-title">
                <!-- svelte-ignore a11y-interactive-supports-focus -->
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <span role="link" class="clickable-link" on:click={handleFileIconClick} data-title={title}>{title}</span>
            </div>
        {/if}
        <div class="daily-note-editor"  aria-hidden="true"  bind:this={editorEl} data-title={title} on:click={handleEditorClick}></div>
    </div>
    <div use:inview={{rootMargin: "20%"}} on:inview_enter={showHandler}/>
</div>
<!--<div class="dn-card">-->
<!--    -->
<!--</div>-->

<style>
    .daily-note {
        margin-bottom: var(--size-4-5);
        padding-bottom: var(--size-4-8);
    }

    .daily-note-editor {
        min-height: 100px;
    }

    .daily-note:has(.is-readable-line-width) .daily-note-title {
        max-width: calc(var(--file-line-width) + var(--size-4-4));
        margin-left: auto;
        margin-right: auto;
        margin-bottom: var(--size-4-8);
    }

    .daily-note-title {
        display: flex;
        justify-content: space-between;
        margin-top: var(--size-4-8);
    }

    .clickable-link {
        cursor: pointer;
        text-decoration: none;
    }

    .clickable-link:hover {
        color: var(--color-accent);
        text-decoration: underline;
    }
</style>
