<script lang="ts">
    import type DailyNoteViewPlugin from "../dailyNoteViewIndex";
    import { TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
    import { spawnLeafView } from "../leafView";
    import { inview } from "svelte-inview";

    export let file: TAbstractFile;
    export let plugin: DailyNoteViewPlugin;
    export let leaf: WorkspaceLeaf;

    let editorEl: HTMLElement;
    let title: string;

    let rendered = false;

    let createdLeaf: WorkspaceLeaf;

    $: if(file && editorEl) {
        showEditor();
    }

    function showEditor() {
        if(rendered) return;
        createdLeaf = spawnLeafView(plugin, editorEl, leaf);
        createdLeaf.setPinned(true);
        if(file instanceof TFile) {
            createdLeaf.openFile(file, {active: false, state: {mode: "source"}});
            title = file.basename;
        }
        rendered = true;
    }

    function handleClick() {
        if(!(file instanceof TFile)) return;
        if(leaf) {
            leaf.openFile(file);
        } else app.workspace.getLeaf(false).openFile(file);
    }

    function hideHandler(event: any) {
        const { scrollDirection } = event.detail;
        if(scrollDirection.vertical === "up") {
            rendered = false;
            editorEl.empty();
        }
    }

    function showHandler(event: any) {
        const { scrollDirection } = event.detail;
        if(scrollDirection.vertical === "down") {
            showEditor();
        }
    }
</script>

<div class="daily-note-container">
    <div class="daily-note">
        {#if title}
            <div class="daily-note-title" on:click={handleClick} aria-hidden="true">
                {title}
            </div>
        {/if}
        <div class="daily-note-editor" bind:this={editorEl}></div>
    </div>
    <div use:inview={{}} on:leave={hideHandler} on:enter={showHandler} />
</div>
<!--<div class="dn-card">-->
<!--    -->
<!--</div>-->

<style>
    /*.dn-card {*/
    /*    background-color: white;*/
    /*    border-radius: 10px;*/
    /*    filter: drop-shadow(0 20px 13px rgb(0 0 0 / 0.03)) drop-shadow(0 8px 5px rgb(0 0 0 / 0.08));*/
    /*    height: 400px;*/
    /*    overflow-y: auto;*/
    /*    margin: 9px;*/
    /*}*/

    .daily-note{
        margin-bottom: 20px;
        padding-bottom: 20px;
    }

    .daily-note-title{
        max-width: var(--file-line-width) ;
        margin-left: auto;
        margin-right: auto;
        margin-bottom: 20px;
        padding-right: 30px;
        font-size: 42px;
        font-weight: bolder;
        color: var(--color-orange);
    }

    .daily-note-title:hover{
        background-color: azure;
    }
</style>
