<script lang="ts">
    import type DailyNoteViewPlugin from "../dailyNoteViewIndex";
    import { TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
    import { DailyNoteEditor, spawnLeafView } from "../leafView";
    import { inview } from "svelte-inview";

    export let file: TAbstractFile;
    export let plugin: DailyNoteViewPlugin;
    export let leaf: WorkspaceLeaf;

    let editorEl: HTMLElement;
    let title: string;

    let rendered: boolean = false;
    let id: string;

    let createdLeaf: WorkspaceLeaf;
    let dnEditor: DailyNoteEditor;

    $: if (editorEl) {
        showEditor();
        id = genId(8);
    }

    function genId(size: number): string {
        const chars = [];
        for (let n = 0; n < size; n++) chars.push(((16 * Math.random()) | 0).toString(16));
        return chars.join("");
    }

    function showEditor() {
        if (!(file instanceof TFile)) return;
        if (rendered) return;

        title = file.basename;

        [createdLeaf, dnEditor] = spawnLeafView(plugin, editorEl, leaf);
        createdLeaf.setPinned(true);

        createdLeaf.openFile(file, {active: false, state: {mode: "source"}});
        rendered = true;
    }

    function handleClick() {
        if (!(file instanceof TFile)) return;
        if (leaf) {
            leaf.openFile(file);
        } else app.workspace.getLeaf(false).openFile(file);
    }

    function hideHandler(event: any) {
        const {scrollDirection} = event.detail;
        if (scrollDirection.vertical === "up") {
            rendered = false;
            dnEditor.hide();
        }
    }

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
            <div class="daily-note-title" on:click={handleClick} aria-hidden="true">
                {title}
            </div>
        {/if}
        <div class="daily-note-editor" bind:this={editorEl} aria-label={title}></div>
    </div>
    <div use:inview={{rootMargin: "20%"}} on:leave={hideHandler} on:enter={showHandler}/>
</div>
<!--<div class="dn-card">-->
<!--    -->
<!--</div>-->

<style>
    .daily-note {
        margin-bottom: var(--size-4-5);
        padding-bottom: var(--size-4-5);
    }

    .daily-note-title {
        font-size: var(--h1-size);
        font-weight: var(--font-bold);
        color: var(--background-modifier);

        margin-bottom: var(--size-4-4);
    }

    .daily-note-title:hover {
        background-color: var(--background-modifier-hover);
    }
</style>
