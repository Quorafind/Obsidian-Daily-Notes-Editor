<script lang="ts">
    import type DailyNoteViewPlugin from "../dailyNoteViewIndex";
    import type {  WorkspaceLeaf } from "obsidian";

    import { TFile, moment } from "obsidian";
    import DailyNote from "./DailyNote.svelte";
    import { inview } from "svelte-inview";
    import { getAllDailyNotes, getDailyNote, createDailyNote, getDateFromFile } from 'obsidian-daily-notes-interface';

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
        // Build notes list by date in descending order.
        for (const string of Object.keys(cacheDailyNotes).sort().reverse()) {
            allDailyNotes.push(<TFile>cacheDailyNotes[string]);
        }
        hasFetch = true;
        checkDailyNote();
    }

    function checkDailyNote() {
        // @ts-ignore
        const currentDate = moment();
        const currentDailyNote = getDailyNote(currentDate, cacheDailyNotes);

        // console.log(currentDate, cacheDailyNotes);
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

    export function check() {
        checkDailyNote();
    }

    export function fileCreate(file: TFile) {
        if(!getDateFromFile(file, 'day')) return;
        // Check if this daily note is between the end of day in renderedDailyNotes and the start of day in renderedDailyNotes
        // If it is, add it to renderedDailyNotes
        // If it is not, add it to allDailyNotes
        if(renderedDailyNotes.length === 0) {
            allDailyNotes.push(file);
            allDailyNotes = allDailyNotes.sort((a, b) => {
                // @ts-ignore
                return parseInt(moment(b.basename).format('x')) - parseInt(moment(a.basename).format('x'));
            });
            return;
        }

        const lastRenderedDailyNote = renderedDailyNotes[renderedDailyNotes.length - 1];
        const firstRenderedDailyNote = renderedDailyNotes[0];
        // @ts-ignore
        const lastRenderedDailyNoteDate = moment(lastRenderedDailyNote.basename);
        // @ts-ignore
        const firstRenderedDailyNoteDate = moment(firstRenderedDailyNote.basename);
        // @ts-ignore
        const fileDate = moment(file.basename);

        if(fileDate.isBetween(lastRenderedDailyNoteDate, firstRenderedDailyNoteDate)) {
            renderedDailyNotes.push(file);
            renderedDailyNotes = renderedDailyNotes.sort((a, b) => {
                // @ts-ignore
                return parseInt(moment(b.basename).format('x')) - parseInt(moment(a.basename).format('x'));
            });
        } else if(fileDate.isBefore(lastRenderedDailyNoteDate)) {
            allDailyNotes.push(file);
            allDailyNotes = allDailyNotes.sort((a, b) => {
                // @ts-ignore
                return parseInt(moment(b.basename).format('x')) - parseInt(moment(a.basename).format('x'));
            });
        } else if(fileDate.isAfter(firstRenderedDailyNoteDate)) {
            renderedDailyNotes.push(file);
            renderedDailyNotes = renderedDailyNotes.sort((a, b) => {
                // @ts-ignore
                return parseInt(moment(b.basename).format('x')) - parseInt(moment(a.basename).format('x'));
            });
        }

        // @ts-ignore
        if(fileDate.isSame(moment(), 'day')) hasCurrentDay = true;
    }

    export function fileDelete(file: TFile) {
        if(!getDateFromFile(file, 'day')) return;
        renderedDailyNotes = renderedDailyNotes.filter((dailyNote) => {
            return dailyNote.basename !== file.basename;
        });
        allDailyNotes = allDailyNotes.filter((dailyNote) => {
            return dailyNote.basename !== file.basename;
        });
        checkDailyNote();
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
