export type TimeRange =
    | "week"
    | "month"
    | "year"
    | "all"
    | "last-week"
    | "last-month"
    | "last-year"
    | "quarter"
    | "last-quarter"
    | "custom";

export type SelectionMode = "daily" | "folder" | "tag";

export type TimeField = "ctime" | "mtime" | "ctimeReverse" | "mtimeReverse";
