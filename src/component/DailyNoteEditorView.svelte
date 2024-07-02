<script lang="ts">
    import type DailyNoteViewPlugin from "../dailyNoteViewIndex";
    import type { WorkspaceLeaf } from "obsidian";

    import { TFile, moment } from "obsidian";
    import DailyNote from "./DailyNote.svelte";
    import { inview } from "svelte-inview";
    import {
        getAllDailyNotes,
        getDailyNote,
        createDailyNote,
        getDateFromFile,
        getDailyNoteSettings,
        DEFAULT_DAILY_NOTE_FORMAT
    } from 'obsidian-daily-notes-interface';

    export let plugin: DailyNoteViewPlugin;
    export let leaf: WorkspaceLeaf;
    const size = 1;
    let intervalId;

    let cacheDailyNotes: Record<string, any>;
    let allDailyNotes: TFile[] = [];
    let renderedDailyNotes: TFile[] = [];

    let hasMore = true;
    let hasFetch = false;
    let hasCurrentDay: boolean = true;

    $: if (hasMore && !hasFetch) {
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
        if (!currentDailyNote) {
            hasCurrentDay = false;
        }
    }

    async function createNewDailyNote() {
        const currentDate = moment();
        if (!hasCurrentDay) {
            const currentDailyNote: any = await createDailyNote(currentDate);
            renderedDailyNotes.push(currentDailyNote);

            renderedDailyNotes = sortDailyNotes(renderedDailyNotes);
            hasCurrentDay = true;
        }
    }

    function startFillViewport() {
        if (!intervalId) {
            intervalId = setInterval(infiniteHandler, 1);
        }
    }

    function stopFillViewport() {
        clearInterval(intervalId);
        intervalId = null;
    }

    function infiniteHandler() {
        if (!hasFetch || !hasMore) return;
        if (allDailyNotes.length === 0 && hasFetch) {
            hasMore = false;
        } else {
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

    function sortDailyNotes(notes: TFile[]): TFile[] {
        const fileFormat = getDailyNoteSettings().format || DEFAULT_DAILY_NOTE_FORMAT;

        return notes.sort((a, b) => {
            return moment(b.basename, fileFormat).valueOf() - moment(a.basename, fileFormat).valueOf();
        });
    }

    export function fileCreate(file: TFile) {
        const fileDate = getDateFromFile(file as TFile, 'day');
        const fileFormat = getDailyNoteSettings().format || DEFAULT_DAILY_NOTE_FORMAT;
        if (!fileDate) return;

        if (renderedDailyNotes.length === 0) {
            allDailyNotes.push(file);
            allDailyNotes = sortDailyNotes(allDailyNotes);
            return;
        }

        const lastRenderedDailyNote = renderedDailyNotes[renderedDailyNotes.length - 1];
        const firstRenderedDailyNote = renderedDailyNotes[0];
        const lastRenderedDailyNoteDate = moment(lastRenderedDailyNote.basename, fileFormat);
        const firstRenderedDailyNoteDate = moment(firstRenderedDailyNote.basename, fileFormat);

        if (fileDate.isBetween(lastRenderedDailyNoteDate, firstRenderedDailyNoteDate)) {
            renderedDailyNotes.push(file);
            renderedDailyNotes = sortDailyNotes(renderedDailyNotes);
        } else if (fileDate.isBefore(lastRenderedDailyNoteDate)) {
            allDailyNotes.push(file);
            allDailyNotes = sortDailyNotes(allDailyNotes);
        } else if (fileDate.isAfter(firstRenderedDailyNoteDate)) {
            renderedDailyNotes.push(file);
            renderedDailyNotes = sortDailyNotes(renderedDailyNotes);
        }

        if (fileDate.isSame(moment(), 'day')) hasCurrentDay = true;
    }


    export function fileDelete(file: TFile) {
        if (!getDateFromFile(file as TFile, 'day')) return;
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
    <div use:inview={{}} on:inview_init={startFillViewport} on:inview_change={infiniteHandler}
         on:inview_leave={stopFillViewport}/>
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
        max-width: var(--file-line-width);
        color: var(--color-base-40);
        padding-top: 20px;
        padding-bottom: 20px;
        transition: all 300ms;
    }

    .dn-blank-day:hover {
        padding-top: 40px;
        padding-bottom: 40px;
        transition: padding 300ms;
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
