<script lang="ts">
    import type DailyNoteViewPlugin from "../dailyNoteViewIndex";
    import type { WorkspaceLeaf } from "obsidian";

    import { TFile, moment } from "obsidian";
    import DailyNote from "./DailyNote.svelte";
    import { inview } from "svelte-inview";
    import { TimeRange, SelectionMode, TimeField } from "../types/time";
    import { onMount } from "svelte";
    import { FileManager, FileManagerOptions } from "../utils/fileManager";


    export let plugin: DailyNoteViewPlugin;
    export let leaf: WorkspaceLeaf;
    export let selectedRange: TimeRange = "all";
    export let customRange: { start: Date; end: Date } | null = null;
    export let selectionMode: SelectionMode = "daily";
    export let target: string = "";
    export let timeField: TimeField = "mtime"; // 默认使用修改时间
    
    const size = 1;
    let intervalId;

    let renderedFiles: TFile[] = [];
    let filteredFiles: TFile[] = [];

    let hasMore = true;
    let firstLoaded = true;
    let loaderRef: HTMLDivElement;

    // Create the file manager
    let fileManager: FileManager;
    
    $: fileManagerOptions = {
        mode: selectionMode,
        target: target,
        timeRange: selectedRange,
        customRange: customRange,
        app: plugin.app,
        timeField: timeField
    } as FileManagerOptions;

    $: if (fileManager && (selectedRange !== fileManager.options.timeRange || 
                          customRange !== fileManager.options.customRange ||
                          selectionMode !== fileManager.options.mode ||
                          target !== fileManager.options.target ||
                          timeField !== fileManager.options.timeField)) {
        fileManager.updateOptions({
            timeRange: selectedRange,
            customRange: customRange,
            mode: selectionMode,
            target: target,
            timeField: timeField
        });
        
        // Reset rendered files and start filling viewport again
        renderedFiles = [];
        filteredFiles = fileManager.getFilteredFiles();
        hasMore = filteredFiles.length > 0;
        firstLoaded = true;
        startFillViewport();
        
        // Update the title element with the new range information
        updateTitleElement();
    }

    onMount(() => {
        fileManager = new FileManager(fileManagerOptions);
        filteredFiles = fileManager.getFilteredFiles();
        hasMore = filteredFiles.length > 0;
        startFillViewport();
        
        // Initialize the title element
        updateTitleElement();
    });

    // Function to update the title element with range information
    function updateTitleElement() {
        if (!leaf || !leaf.view || !leaf.view.titleEl) return;
         
        // Get the title element and clear it
        const titleEl = leaf.view.titleEl;
        titleEl.empty();
        
        // Set the base title
        let titleText = '';
        
        // Add range information based on the current selection mode and range
        if (selectionMode === "daily" && selectedRange !== 'all') {
            if (selectedRange === 'custom' && customRange) {
                titleText = `Showing notes from: ${moment(customRange.start).format('YYYY-MM-DD')} to ${moment(customRange.end).format('YYYY-MM-DD')}`;
            } else {
                titleText = `Showing notes for: ${selectedRange}`;
            }
        } else if (selectionMode === "folder") {
            titleText = `Showing files from folder: ${target}`;
            if (selectedRange !== 'all') {
                titleText += ` (${timeField === 'ctime' ? 'created' : 'modified'} ${selectedRange})`;
            }
        } else if (selectionMode === "tag") {
            titleText = `Showing files with tag: ${target}`;
            if (selectedRange !== 'all') {
                titleText += ` (${timeField === 'ctime' ? 'created' : 'modified'} ${selectedRange})`;
            }
        }
        
        // Set the title text
        if (titleText) {
            titleEl.setText(titleText);
        } else {
            titleEl.setText("Daily Notes");
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
        console.log("infiniteHandler");
        if (!fileManager || !hasMore) return;
        if (filteredFiles.length === 0) {
            hasMore = false;
        } else {
            renderedFiles = [
                ...renderedFiles,
                ...filteredFiles.splice(0, size)
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

    async function createNewDailyNote() {
        const newNote = await fileManager.createNewDailyNote();
        if (newNote) {
            renderedFiles = [newNote, ...renderedFiles];
        }
    }

    export function tick() {
        renderedFiles = renderedFiles;
    }

    export function check() {
        fileManager.checkDailyNote();
    }

    export function fileCreate(file: TFile) {
        fileManager.fileCreate(file);
        
        // Update the rendered files if needed
        if (selectionMode === "daily") {
            // For daily notes, we need to check if the file should be added to the rendered files
            const filteredFiles = fileManager.getFilteredFiles();
            if (filteredFiles.some(f => f.basename === file.basename) && 
                !renderedFiles.some(f => f.basename === file.basename)) {
                renderedFiles = [file, ...renderedFiles];
            }
        } else {
            // For folder and tag modes, we can simply update the rendered files
            renderedFiles = fileManager.getFilteredFiles().slice(0, renderedFiles.length);
        }
    }

    export function fileDelete(file: TFile) {
        fileManager.fileDelete(file);
        
        // Remove the file from rendered files if it exists
        renderedFiles = renderedFiles.filter((dailyNote) => {
            return dailyNote.basename !== file.basename;
        });
    }
</script>

<div class="daily-note-view">
    {#if renderedFiles.length === 0}
        <div class="dn-stock">
            <div class="dn-stock-text">
                No files found
            </div>
        </div>
    {/if}
    {#if selectionMode === "daily" && !fileManager?.hasCurrentDayNote() && (selectedRange === 'all' || selectedRange === 'week' || selectedRange === 'month' || selectedRange === 'year' || selectedRange === 'quarter')}
        <div class="dn-blank-day" on:click={createNewDailyNote} aria-hidden="true">
            <div class="dn-blank-day-text">
                Create a daily note for today ✍
            </div>
        </div>
    {/if}
    {#each renderedFiles as file (file)}
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

        display: flex;
        justify-content: center;
        align-items: center;
    }

    .dn-stock-text {
        text-align: center;
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
</style>
