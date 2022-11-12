<script lang="ts">
    import type DailyNoteViewPlugin from "../dailyNoteViewIndex";
    import type { TFile, WorkspaceLeaf } from "obsidian";
    import DailyNote from "./DailyNote.svelte";
    import { inview } from "svelte-inview";
    import { getAllDailyNotes } from 'obsidian-daily-notes-interface';

    export let plugin: DailyNoteViewPlugin;
    export let leaf: WorkspaceLeaf;
    let size = 1;
    let files: TFile[] = [];
    let allFiles: TFile[] = [];

    let hasMore = true;
    let hasFetch = false;

    $: if(hasMore && !hasFetch) {
        const dailyNotes = getAllDailyNotes();
        for (const string in dailyNotes) {
            allFiles.push(<TFile>dailyNotes[string]);
        }
        hasFetch = true;
    }

    function infiniteHandler()  {
        if(!hasFetch || !hasMore) return;
        if(allFiles.length === 0 && hasFetch) {
            hasMore = false;
        }else {
            files = [
                ...files,
                ...allFiles.splice(0, size)
            ];
        }
    }

    export function tick() {
        files = files;
    }
</script>

<div class="daily-note-view">
    {#if files.length === 0}
        <div class="dn-stock"></div>
    {/if}
    {#each files as file}
        <DailyNote file={file} plugin={plugin} leaf={leaf}/>
    {/each}
    <div use:inview={{}} on:init={infiniteHandler} on:change={infiniteHandler} />
    {#if !hasMore}
        <div class="no-more-text">—— No more of results ——</div>
    {/if}
</div>

<style>
    .dn-stock {
        height: 1000px;
        width: 100%;
    }

    .no-more-text {
        margin-left: auto;
        margin-right: auto;
        text-align: center;
    }

    /*.daily-note-view{*/
    /*    display: flex;*/
    /*    flex-direction: row;*/
    /*}*/
</style>
