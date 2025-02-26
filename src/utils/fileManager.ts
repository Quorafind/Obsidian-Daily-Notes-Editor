import { TFile, moment, App } from "obsidian";
import {
    getAllDailyNotes,
    getDailyNote,
    createDailyNote,
    getDateFromFile,
    getDailyNoteSettings,
    DEFAULT_DAILY_NOTE_FORMAT,
} from "obsidian-daily-notes-interface";
import { TimeRange, TimeField } from "../types/time";

export interface FileManagerOptions {
    mode: "daily" | "folder" | "tag";
    target?: string;
    timeRange?: TimeRange;
    customRange?: { start: Date; end: Date } | null;
    app?: App;
    timeField?: TimeField;
}

export class FileManager {
    private allFiles: TFile[] = [];
    private filteredFiles: TFile[] = [];
    private hasFetched: boolean = false;
    private hasCurrentDay: boolean = true;
    private cacheDailyNotes: Record<string, any> = {};

    // Make options public so it can be accessed from outside
    public options: FileManagerOptions;

    constructor(options: FileManagerOptions) {
        this.options = options;
        this.fetchFiles();
    }

    public fetchFiles(): void {
        if (this.hasFetched) return;

        switch (this.options.mode) {
            case "daily":
                this.fetchDailyNotes();
                break;
            case "folder":
                this.fetchFolderFiles();
                break;
            case "tag":
                this.fetchTaggedFiles();
                break;
        }

        this.hasFetched = true;
        this.checkDailyNote();
        this.filterFilesByRange();
    }

    private fetchDailyNotes(): void {
        this.cacheDailyNotes = getAllDailyNotes();
        // Build notes list by date in descending order.
        for (const string of Object.keys(this.cacheDailyNotes)
            .sort()
            .reverse()) {
            this.allFiles.push(<TFile>this.cacheDailyNotes[string]);
        }
    }

    private fetchFolderFiles(): void {
        if (!this.options.target || !this.options.app) return;

        // Get all files in the vault
        const allFiles = this.options.app.vault.getFiles();

        // Filter files by folder path
        this.allFiles = allFiles.filter((file) => {
            const folderPath = file.parent?.path || "";
            return (
                folderPath === this.options.target ||
                folderPath.startsWith(this.options.target + "/")
            );
        });

        // Get the time field and check if it's reverse
        const timeField = this.options.timeField || "mtime";
        const isReverse = timeField.endsWith("Reverse");
        const baseTimeField = isReverse
            ? timeField.replace("Reverse", "")
            : timeField;

        // Sort files by the specified time field
        this.allFiles = this.allFiles.sort((a, b) => {
            // If reverse is true, swap a and b to reverse the order
            if (isReverse) {
                return a.stat[baseTimeField] - b.stat[baseTimeField];
            }
            return b.stat[baseTimeField] - a.stat[baseTimeField];
        });
    }

    private fetchTaggedFiles(): void {
        if (!this.options.target || !this.options.app) return;

        // Get all files with the specified tag
        const allFiles = this.options.app.vault.getFiles();
        const targetTag = this.options.target.startsWith("#")
            ? this.options.target
            : "#" + this.options.target;

        this.allFiles = allFiles.filter((file) => {
            // Check if the file has the target tag in its cache
            const fileCache =
                this.options.app?.metadataCache.getFileCache(file);
            if (!fileCache || !fileCache.tags) return false;

            return fileCache.tags.some((tag) => tag.tag === targetTag);
        });

        // Get the time field and check if it's reverse
        const timeField = this.options.timeField || "mtime";
        const isReverse = timeField.endsWith("Reverse");
        const baseTimeField = isReverse
            ? timeField.replace("Reverse", "")
            : timeField;

        // Sort files by the specified time field
        this.allFiles = this.allFiles.sort((a, b) => {
            // If reverse is true, swap a and b to reverse the order
            if (isReverse) {
                return a.stat[baseTimeField] - b.stat[baseTimeField];
            }
            return b.stat[baseTimeField] - a.stat[baseTimeField];
        });
    }

    public filterFilesByRange(): TFile[] {
        // If no time range is specified, return all files
        if (!this.options.timeRange) {
            this.filteredFiles = [...this.allFiles];
            return this.filteredFiles;
        }

        // Reset the filtered files list
        this.filteredFiles = [];

        // If the time range is "all", return all files
        if (this.options.timeRange === "all") {
            this.filteredFiles = [...this.allFiles];
            return this.filteredFiles;
        }

        // Use different filtering methods based on different modes
        if (this.options.mode === "daily") {
            // Daily mode: filter daily notes by date
            this.filterDailyNotesByRange();
        } else {
            // Folder and tag modes: filter files by creation or modification time
            this.filterFilesByTimeRange();
        }

        return this.filteredFiles;
    }

    /**
     * Filter files by time range
     * Applicable to folder and tag modes
     */
    private filterFilesByTimeRange(): void {
        const now = moment();
        const timeField = this.options.timeField || "mtime";

        // Check if it's a reverse time field
        const isReverse = timeField.endsWith("Reverse");
        // Extract the base time field (remove "Reverse" suffix if present)
        const baseTimeField = isReverse
            ? timeField.replace("Reverse", "")
            : timeField;

        // Filter files by creation or modification time
        this.filteredFiles = this.allFiles.filter((file) => {
            // Get the time of the file based on the base timeField option
            const fileDate = moment(file.stat[baseTimeField]);

            return this.isDateInRange(fileDate, now);
        });

        // If using reverse time field, reverse the order of filtered files
        if (isReverse) {
            this.filteredFiles.reverse();
        }
    }

    /**
     * Filter daily notes by date
     * Applicable to daily mode
     */
    private filterDailyNotesByRange(): void {
        const now = moment();
        const fileFormat =
            getDailyNoteSettings().format || DEFAULT_DAILY_NOTE_FORMAT;

        this.filteredFiles = this.allFiles.filter((file) => {
            const fileDate = moment(file.basename, fileFormat);

            return this.isDateInRange(fileDate, now);
        });
    }

    /**
     * Check if the file date is in the range
     * @param fileDate file date
     * @param now current date
     * @returns whether in the range
     */
    private isDateInRange(
        fileDate: moment.Moment,
        now: moment.Moment
    ): boolean {
        switch (this.options.timeRange) {
            case "week":
                return fileDate.isSame(now, "week");
            case "month":
                return fileDate.isSame(now, "month");
            case "year":
                return fileDate.isSame(now, "year");
            case "last-week":
                return fileDate.isBetween(
                    moment().subtract(1, "week").startOf("week"),
                    moment().subtract(1, "week").endOf("week"),
                    null,
                    "[]"
                );
            case "last-month":
                return fileDate.isBetween(
                    moment().subtract(1, "month").startOf("month"),
                    moment().subtract(1, "month").endOf("month"),
                    null,
                    "[]"
                );
            case "last-year":
                return fileDate.isBetween(
                    moment().subtract(1, "year").startOf("year"),
                    moment().subtract(1, "year").endOf("year"),
                    null,
                    "[]"
                );
            case "quarter":
                return fileDate.isSame(now, "quarter");
            case "last-quarter":
                return fileDate.isBetween(
                    moment().subtract(1, "quarter").startOf("quarter"),
                    moment().subtract(1, "quarter").endOf("quarter"),
                    null,
                    "[]"
                );
            case "custom":
                if (this.options.customRange) {
                    const startDate = moment(this.options.customRange.start);
                    const endDate = moment(this.options.customRange.end);
                    return fileDate.isBetween(startDate, endDate, null, "[]");
                }
                return false;
            default:
                return true;
        }
    }

    public checkDailyNote(): boolean {
        if (this.options.mode !== "daily") {
            this.hasCurrentDay = true;
            return true;
        }

        // @ts-ignore
        const currentDate = moment();
        const currentDailyNote = getDailyNote(
            currentDate,
            this.cacheDailyNotes
        );

        if (!currentDailyNote) {
            this.hasCurrentDay = false;
            return false;
        }

        this.hasCurrentDay = true;
        return true;
    }

    public async createNewDailyNote(): Promise<TFile | null> {
        if (this.options.mode !== "daily" || this.hasCurrentDay) {
            return null;
        }

        const currentDate = moment();
        const currentDailyNote: any = await createDailyNote(currentDate);

        if (currentDailyNote) {
            this.allFiles.push(currentDailyNote);
            this.allFiles = this.sortDailyNotes(this.allFiles);
            this.hasCurrentDay = true;
            this.filterFilesByRange();
            return currentDailyNote;
        }

        return null;
    }

    public fileCreate(file: TFile): void {
        if (this.options.mode === "daily") {
            this.handleDailyNoteCreate(file);
        } else if (this.options.mode === "folder") {
            this.handleFolderFileCreate(file);
        } else if (this.options.mode === "tag") {
            this.handleTaggedFileCreate(file);
        }
    }

    private handleDailyNoteCreate(file: TFile): void {
        const fileDate = getDateFromFile(file as any, "day");
        const fileFormat =
            getDailyNoteSettings().format || DEFAULT_DAILY_NOTE_FORMAT;
        if (!fileDate) return;

        if (this.filteredFiles.length === 0) {
            this.allFiles.push(file);
            this.allFiles = this.sortDailyNotes(this.allFiles);
            this.filterFilesByRange();
            return;
        }

        const lastFilteredFile =
            this.filteredFiles[this.filteredFiles.length - 1];
        const firstFilteredFile = this.filteredFiles[0];
        const lastFilteredFileDate = moment(
            lastFilteredFile.basename,
            fileFormat
        );
        const firstFilteredFileDate = moment(
            firstFilteredFile.basename,
            fileFormat
        );

        if (fileDate.isBetween(lastFilteredFileDate, firstFilteredFileDate)) {
            this.filteredFiles.push(file);
            this.filteredFiles = this.sortDailyNotes(this.filteredFiles);
        } else if (fileDate.isBefore(lastFilteredFileDate)) {
            this.allFiles.push(file);
            this.allFiles = this.sortDailyNotes(this.allFiles);
            this.filterFilesByRange();
        } else if (fileDate.isAfter(firstFilteredFileDate)) {
            this.filteredFiles.push(file);
            this.filteredFiles = this.sortDailyNotes(this.filteredFiles);
        }

        if (fileDate.isSame(moment(), "day")) this.hasCurrentDay = true;
    }

    private handleFolderFileCreate(file: TFile): void {
        if (!this.options.target) return;

        // Check if the file belongs to the target folder
        const folderPath = file.parent?.path || "";
        if (
            folderPath === this.options.target ||
            folderPath.startsWith(this.options.target + "/")
        ) {
            // Add the file to the collections
            this.allFiles.push(file);

            // Get the time field and check if it's reverse
            const timeField = this.options.timeField || "mtime";
            const isReverse = timeField.endsWith("Reverse");
            const baseTimeField = isReverse
                ? timeField.replace("Reverse", "")
                : timeField;

            // Sort files by the specified time field
            this.allFiles = this.allFiles.sort((a, b) => {
                // If reverse is true, swap a and b to reverse the order
                if (isReverse) {
                    return a.stat[baseTimeField] - b.stat[baseTimeField];
                }
                return b.stat[baseTimeField] - a.stat[baseTimeField];
            });

            // Update filtered files
            this.filterFilesByRange();
        }
    }

    private handleTaggedFileCreate(file: TFile): void {
        if (!this.options.target || !this.options.app) return;

        // Check if the file has the target tag
        const targetTag = this.options.target.startsWith("#")
            ? this.options.target
            : "#" + this.options.target;

        const fileCache = this.options.app.metadataCache.getFileCache(file);
        if (!fileCache || !fileCache.tags) return;

        if (fileCache.tags.some((tag) => tag.tag === targetTag)) {
            // Add the file to the collections
            this.allFiles.push(file);

            // Get the time field and check if it's reverse
            const timeField = this.options.timeField || "mtime";
            const isReverse = timeField.endsWith("Reverse");
            const baseTimeField = isReverse
                ? timeField.replace("Reverse", "")
                : timeField;

            // Sort files by the specified time field
            this.allFiles = this.allFiles.sort((a, b) => {
                // If reverse is true, swap a and b to reverse the order
                if (isReverse) {
                    return a.stat[baseTimeField] - b.stat[baseTimeField];
                }
                return b.stat[baseTimeField] - a.stat[baseTimeField];
            });

            // Update filtered files
            this.filterFilesByRange();
        }
    }

    public fileDelete(file: TFile): void {
        if (
            this.options.mode === "daily" &&
            getDateFromFile(file as any, "day")
        ) {
            this.filteredFiles = this.filteredFiles.filter((f) => {
                return f.basename !== file.basename;
            });
            this.allFiles = this.allFiles.filter((f) => {
                return f.basename !== file.basename;
            });
            this.filterFilesByRange();
            this.checkDailyNote();
        } else {
            // Handle deletion for folder and tag modes
            this.filteredFiles = this.filteredFiles.filter((f) => {
                return f.basename !== file.basename;
            });
            this.allFiles = this.allFiles.filter((f) => {
                return f.basename !== file.basename;
            });
        }
    }

    private sortDailyNotes(notes: TFile[]): TFile[] {
        const fileFormat =
            getDailyNoteSettings().format || DEFAULT_DAILY_NOTE_FORMAT;

        return notes.sort((a, b) => {
            return (
                moment(b.basename, fileFormat).valueOf() -
                moment(a.basename, fileFormat).valueOf()
            );
        });
    }

    public getAllFiles(): TFile[] {
        return this.allFiles;
    }

    public getFilteredFiles(): TFile[] {
        return this.filteredFiles;
    }

    public hasCurrentDayNote(): boolean {
        return this.hasCurrentDay;
    }

    public updateOptions(options: Partial<FileManagerOptions>): void {
        this.options = { ...this.options, ...options };

        if (options.timeRange || options.customRange) {
            this.filterFilesByRange();
        }

        if (options.mode || options.target) {
            this.allFiles = [];
            this.filteredFiles = [];
            this.hasFetched = false;
            this.fetchFiles();
        }
    }
}
