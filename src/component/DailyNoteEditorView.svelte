<script lang="ts">
    import type DailyNoteViewPlugin from "../dailyNoteViewIndex";
    import type {  WorkspaceLeaf } from "obsidian";

    import { TFile, moment } from "obsidian";
    import DailyNote from "./DailyNote.svelte";
    import { inview } from "svelte-inview";
    import { getAllDailyNotes, getDailyNote, createDailyNote } from 'obsidian-daily-notes-interface';

    export let plugin: DailyNoteViewPlugin;
    export let leaf: WorkspaceLeaf;
    let size = 1;

    let cacheDailyNotes: Record<string, any>;
    let allDailyNotes: TFile[] = [];
    let renderedDailyNotes: TFile[] = [];

    let hasMore = true;
    let hasFetch = false;
    let hasCurrentDay: boolean = true;

    $: if(hasMore && !hasFetch) {
        cacheDailyNotes = getAllDailyNotes();
        for (const string in cacheDailyNotes) {
            allDailyNotes.push(<TFile>cacheDailyNotes[string]);
        }
        hasFetch = true;
        checkDailyNote();
    }

    function checkDailyNote() {
        // @ts-ignore
        const currentDate = moment();
        const currentDailyNote = getDailyNote(currentDate, cacheDailyNotes);
        if(!currentDailyNote) {
            hasCurrentDay = false;
        }
    }

    async function createNewDailyNote() {
        // @ts-ignore
        const currentDate = moment();
        if(!hasCurrentDay) {
            const currentDailyNote = await createDailyNote(currentDate);
            if(currentDailyNote instanceof TFile) renderedDailyNotes.push(currentDailyNote);

            renderedDailyNotes = renderedDailyNotes.sort((a, b) => {
                // @ts-ignore
                return parseInt(moment(b.basename).format('x')) - parseInt(moment(a.basename).format('x'));
            });
            console.log(renderedDailyNotes);
            hasCurrentDay = true;
        }
    }

    function infiniteHandler()  {
        if(!hasFetch || !hasMore) return;
        if(allDailyNotes.length === 0 && hasFetch) {
            hasMore = false;
        }else {
            renderedDailyNotes = [
                ...renderedDailyNotes,
                ...allDailyNotes.splice(0, size)
            ];
        }
    }

    export function tick() {
        renderedDailyNotes = renderedDailyNotes;
    }
</script>

<div class="daily-note-view">
    {#if renderedDailyNotes.length === 0}
        <div class="dn-stock"></div>
    {/if}
    {#if !hasCurrentDay}
        <div class="dn-blank-day" on:click={createNewDailyNote} aria-hidden="true">
            <div class="dn-blank-day-text">
                Create a daily note for today ✍
            </div>
        </div>
    {/if}
    {#each renderedDailyNotes as file (file)}
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

    .dn-blank-day {
        display: flex;
        margin-left: auto;
        margin-right: auto;
        max-width: var(--file-line-width) ;
        color: var(--color-base-40);
        padding-top: 20px;
        padding-bottom: 20px;
        transition: all 300ms;
    }

    .dn-blank-day:hover {
        padding-top: 40px;
        padding-bottom: 40px;
        background-color: var(--color-base-20);
        transition: all 300ms;
        color: var(--color-base-80);
    }

    .dn-blank-day-text {
        margin-left: auto;
        margin-right: auto;
        text-align: center;
    }

    /*.daily-note-view{*/
    /*    display: flex;*/
    /*    flex-direction: row;*/
    /*}*/
</style>
