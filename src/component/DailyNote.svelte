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

    function handleClick() {
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
</script>

<div class="daily-note-container" aria-label='dn-editor-{id}'>
    <div class="daily-note">
        {#if title}
            <div class="daily-note-title inline-title">
                {title}
                <div class="daily-node-icon clickable-icon" on:click={handleClick} aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                         class="lucide lucide-file-symlink">
                        <path d="m10 18 3-3-3-3"/>
                        <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                        <path d="M4 11V4a2 2 0 0 1 2-2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/>
                    </svg>
                </div>
            </div>
        {/if}
        <div class="daily-note-editor" bind:this={editorEl} aria-label={title}></div>
    </div>
    <div use:inview={{rootMargin: "20%"}} on:inview_enter={showHandler}/>
</div>
<!--<div class="dn-card">-->
<!--    -->
<!--</div>-->

<style>
    .daily-note {
        margin-bottom: var(--size-4-5);
        padding-bottom: var(--size-4-5);
    }

    .daily-note:has(.is-readable-line-width) .daily-note-title {
        max-width: var(--file-line-width);
        margin-left: auto;
        margin-right: auto;
    }

    .daily-note-title {
        display: flex;
        justify-content: space-between;
        margin-top: var(--size-4-12);
    }

    .daily-node-icon {
        width: var(--size-4-8);
        height: var(--size-4-8);
        cursor: pointer;
    }

    .daily-node-icon:hover {
        background-color: var(--background-modifier-hover);
    }
</style>
