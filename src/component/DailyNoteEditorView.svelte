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
    import { onMount } from "svelte";
    import { TimeRange } from "../types/time";


    export let plugin: DailyNoteViewPlugin;
    export let leaf: WorkspaceLeaf;
    export let selectedRange: TimeRange = "all";
    export let customRange: { start: Date; end: Date } | null = null;
    const size = 1;
    let intervalId;

    let cacheDailyNotes: Record<string, any>;
    let allDailyNotes: TFile[] = [];
    let renderedDailyNotes: TFile[] = [];
    let filteredDailyNotes: TFile[] = [];

    let hasMore = true;
    let hasFetch = false;
    let hasCurrentDay: boolean = true;

    let firstLoaded = true;
    let loaderRef: HTMLDivElement;

    $: if (hasMore && !hasFetch) {
        cacheDailyNotes = getAllDailyNotes();
        // Build notes list by date in descending order.
        for (const string of Object.keys(cacheDailyNotes).sort().reverse()) {
            allDailyNotes.push(<TFile>cacheDailyNotes[string]);
        }
        hasFetch = true;
        checkDailyNote();
        filterNotesByRange();
    }

    $: if (selectedRange && hasFetch) {
        filterNotesByRange();
    }

    onMount(() => {
        checkDailyNote();
        startFillViewport();
    });

    function filterNotesByRange() {
        const now = moment();
        const fileFormat = getDailyNoteSettings().format || DEFAULT_DAILY_NOTE_FORMAT;
        
        // Reset filtered notes
        filteredDailyNotes = [];
        
        // Filter notes based on selected range
        if (selectedRange === 'all') {
            filteredDailyNotes = [...allDailyNotes];
        } else {
            filteredDailyNotes = allDailyNotes.filter(file => {
                const fileDate = moment(file.basename, fileFormat);
                
                switch (selectedRange) {
                    case 'week':
                        return fileDate.isSame(now, 'week');
                    case 'month':
                        return fileDate.isSame(now, 'month');
                    case 'year':
                        return fileDate.isSame(now, 'year');
                    case 'last-week':
                        return fileDate.isBetween(
                            moment().subtract(1, 'week').startOf('week'),
                            moment().subtract(1, 'week').endOf('week'),
                            null,
                            '[]'
                        );
                    case 'last-month':
                        return fileDate.isBetween(
                            moment().subtract(1, 'month').startOf('month'),
                            moment().subtract(1, 'month').endOf('month'),
                            null,
                            '[]'
                        );
                    case 'last-year':
                        return fileDate.isBetween(
                            moment().subtract(1, 'year').startOf('year'),
                            moment().subtract(1, 'year').endOf('year'),
                            null,
                            '[]'
                        );
                    case 'quarter':
                        return fileDate.isSame(now, 'quarter');
                    case 'last-quarter':
                        return fileDate.isBetween(
                            moment().subtract(1, 'quarter').startOf('quarter'),
                            moment().subtract(1, 'quarter').endOf('quarter'),
                            null,
                            '[]'
                        );
                    case 'custom':
                        if (customRange) {
                            const startDate = moment(customRange.start);
                            const endDate = moment(customRange.end);
                            return fileDate.isBetween(startDate, endDate, null, '[]');
                        }
                        return false;
                    default:
                        return true;
                }
            });
        }
        
        // Reset rendered notes and start filling viewport again
        renderedDailyNotes = [];
        hasMore = filteredDailyNotes.length > 0;
        firstLoaded = true;
        startFillViewport();
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
        if (filteredDailyNotes.length === 0 && hasFetch) {
            hasMore = false;
        } else {
            renderedDailyNotes = [
                ...renderedDailyNotes,
                ...filteredDailyNotes.splice(0, size)
            ];
            if (firstLoaded) {
                window.setTimeout(() => {
                    ensureViewFilled();
                    firstLoaded = false;
                }, 100);
            }
        }
    }

    function ensureViewFilled() {
        if (loaderRef && loaderRef.getBoundingClientRect().top < leaf.view.contentEl.innerHeight) {
            infiniteHandler();
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
        const fileDate = getDateFromFile(file as any, 'day');
        const fileFormat = getDailyNoteSettings().format || DEFAULT_DAILY_NOTE_FORMAT;
        if (!fileDate) return;

        if (renderedDailyNotes.length === 0) {
            allDailyNotes.push(file);
            allDailyNotes = sortDailyNotes(allDailyNotes);
            filterNotesByRange();
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
            filterNotesByRange();
        } else if (fileDate.isAfter(firstRenderedDailyNoteDate)) {
            renderedDailyNotes.push(file);
            renderedDailyNotes = sortDailyNotes(renderedDailyNotes);
        }

        if (fileDate.isSame(moment(), 'day')) hasCurrentDay = true;
    }


    export function fileDelete(file: TFile) {
        if (!getDateFromFile(file as any, 'day')) return;
        renderedDailyNotes = renderedDailyNotes.filter((dailyNote) => {
            return dailyNote.basename !== file.basename;
        });
        allDailyNotes = allDailyNotes.filter((dailyNote) => {
            return dailyNote.basename !== file.basename;
        });
        filterNotesByRange();
        checkDailyNote();
    }
</script>

<div class="daily-note-view">
    <div class="dn-range-indicator">
        {#if selectedRange !== 'all'}
            <div class="dn-range-text">
                {#if selectedRange === 'custom' && customRange}
                    Showing notes from: {moment(customRange.start).format('YYYY-MM-DD')} to {moment(customRange.end).format('YYYY-MM-DD')}
                {:else}
                    Showing notes for: {selectedRange}
                {/if}
            </div>
        {/if}
    </div>
    {#if renderedDailyNotes.length === 0}
        <div class="dn-stock"></div>
    {/if}
    {#if !hasCurrentDay && (selectedRange === 'all' || selectedRange === 'week' || selectedRange === 'month' || selectedRange === 'year' || selectedRange === 'quarter')}
        <div class="dn-blank-day" on:click={createNewDailyNote} aria-hidden="true">
            <div class="dn-blank-day-text">
                Create a daily note for today ✍
            </div>
        </div>
    {/if}
    {#each renderedDailyNotes as file (file)}
        <DailyNote file={file} plugin={plugin} leaf={leaf}/>
    {/each}
    <div bind:this={loaderRef} class="dn-view-loader" use:inview={{
        root: leaf.view.containerEl
    }} on:inview_init={startFillViewport} on:inview_change={infiniteHandler}
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
    
    .dn-range-indicator {
        margin-left: auto;
        margin-right: auto;
        max-width: var(--file-line-width);
        padding: 5px 0;
    }
    
    .dn-range-text {
        font-size: 0.8em;
        color: var(--color-base-50);
        text-align: center;
        font-style: italic;
    }
</style>
