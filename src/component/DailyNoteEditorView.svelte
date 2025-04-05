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
    
    // Track which notes are in viewport
    let visibleNotes: Set<string> = new Set();

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
        visibleNotes.clear();
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
        if (leaf.height === 0) return;
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
        if (!loaderRef) return;
        
        // Get the loader element's position
        const loaderRect = loaderRef.getBoundingClientRect();
        
        // Get the viewport height
        const viewportHeight = window.innerHeight;
        
        // Get the content element's height (with fallback)
        const contentHeight = leaf.view.contentEl.clientHeight || leaf.view.contentEl.innerHeight || viewportHeight;
        
        // Use the maximum of viewport height and content height with a buffer
        const effectiveHeight = Math.max(viewportHeight, contentHeight) + 200;
        
        // Check if we need to load more content
        if (loaderRect.top < effectiveHeight) {
            infiniteHandler();
            
            // Recursively check again after a short delay to ensure the view is filled
            window.setTimeout(() => {
                if (hasMore && loaderRef && loaderRef.getBoundingClientRect().top < effectiveHeight) {
                    ensureViewFilled();
                }
            }, 50);
        }
    }

    async function createNewDailyNote() {
        const newNote = await fileManager.createNewDailyNote();
        if (newNote) {
            renderedFiles = [newNote, ...renderedFiles];
            // Automatically mark the new note as visible
            visibleNotes.add(newNote.path);
            visibleNotes = visibleNotes;
        }
    }

    export function tick() {
        // First check if we need to update for a new day
        check();
        
        // Force a refresh of the view
        renderedFiles = renderedFiles;
    }

    export function check() {
        // Check if there's a new daily note (e.g., after day change)
        const hadDailyNote = fileManager.hasCurrentDayNote();
        fileManager.checkDailyNote();
        const hasDailyNote = fileManager.hasCurrentDayNote();
        
        // If the daily note status changed (e.g., we just crossed midnight),
        // refresh the file list to ensure we show the current day's daily note
        if (hadDailyNote !== hasDailyNote || 
            (selectionMode === "daily" && selectedRange !== "all")) {
            // Get updated filtered files
            filteredFiles = fileManager.getFilteredFiles();
            
            // Reset rendered files and start filling viewport again if in daily mode
            if (selectionMode === "daily") {
                renderedFiles = [];
                visibleNotes.clear();
                hasMore = filteredFiles.length > 0;
                firstLoaded = true;
                startFillViewport();
            }
        }
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
                // Automatically mark the new note as visible
                visibleNotes.add(file.path);
                visibleNotes = visibleNotes;
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
        
        // Remove from visible notes
        if (visibleNotes.has(file.path)) {
            visibleNotes.delete(file.path);
            visibleNotes = visibleNotes;
        }
    }
    
    // Handle note visibility change
    function handleNoteVisibilityChange(file: TFile, isVisible: boolean) {
        console.log("inview", isVisible)
        if (isVisible) {
            visibleNotes.add(file.path);
        } else {
            visibleNotes.delete(file.path);
        }
        visibleNotes = visibleNotes;
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
    {#each renderedFiles as file (file.path)}
        <div class="daily-note-wrapper" use:inview={{
            rootMargin: "80%",
            unobserveOnEnter: false,
            root: leaf.view.contentEl
        }} on:inview_change={({ detail }) => handleNoteVisibilityChange(file, detail.inView)}>
            <DailyNote 
                file={file} 
                plugin={plugin} 
                leaf={leaf} 
                shouldRender={visibleNotes.has(file.path)}
            />
        </div>
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
    
    .daily-note-wrapper {
        width: 100%;
    }
</style>
