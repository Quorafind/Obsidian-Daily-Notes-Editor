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
        getDailyNoteSettings
    } from 'obsidian-daily-notes-interface';

    export let plugin: DailyNoteViewPlugin;
    export let leaf: WorkspaceLeaf;
    const size = 1;

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
        const fileFormat = getDailyNoteSettings().format || 'YYYY-MM-DD';
        const currentDate = moment();
        if (!hasCurrentDay) {
            const currentDailyNote = await createDailyNote(currentDate);
            renderedDailyNotes.push(currentDailyNote!);

            renderedDailyNotes = renderedDailyNotes.sort((a, b) => {
                return parseInt(moment(b.basename, fileFormat).format('x')) - parseInt(moment(a.basename, fileFormat).format('x'));
            });
            hasCurrentDay = true;
        }
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

    export function fileCreate(file: TFile) {
        const fileDate = getDateFromFile(file, 'day');
        const fileFormat = getDailyNoteSettings().format || 'YYYY-MM-DD';
        if (!fileDate) return;

        function sortNotes(notes: TFile[]): TFile[] {
            return notes.sort((a, b) => {
                return moment(b.basename, fileFormat).valueOf() - moment(a.basename, fileFormat).valueOf();
            });
        }

        if (renderedDailyNotes.length === 0) {
            allDailyNotes.push(file);
            allDailyNotes = sortNotes(allDailyNotes);
            return;
        }

        const lastRenderedDailyNote = renderedDailyNotes[renderedDailyNotes.length - 1];
        const firstRenderedDailyNote = renderedDailyNotes[0];
        const lastRenderedDailyNoteDate = moment(lastRenderedDailyNote.basename, fileFormat);
        const firstRenderedDailyNoteDate = moment(firstRenderedDailyNote.basename, fileFormat);

        if (fileDate.isBetween(lastRenderedDailyNoteDate, firstRenderedDailyNoteDate)) {
            renderedDailyNotes.push(file);
            renderedDailyNotes = sortNotes(renderedDailyNotes);
        } else if (fileDate.isBefore(lastRenderedDailyNoteDate)) {
            allDailyNotes.push(file);
            allDailyNotes = sortNotes(allDailyNotes);
        } else if (fileDate.isAfter(firstRenderedDailyNoteDate)) {
            renderedDailyNotes.push(file);
            renderedDailyNotes = sortNotes(renderedDailyNotes);
        }

        if (fileDate.isSame(moment(), 'day')) hasCurrentDay = true;
    }


    export function fileDelete(file: TFile) {
        if (!getDateFromFile(file, 'day')) return;
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
    <div use:inview={{}} on:init={infiniteHandler} on:change={infiniteHandler}/>
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
