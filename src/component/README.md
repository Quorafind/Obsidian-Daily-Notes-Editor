# Up and Down Navigate Plugin for Obsidian Daily Notes Editor

This plugin adds seamless cursor navigation between notes in the Obsidian Daily Notes Editor. It allows you to navigate between notes using the arrow keys, making it feel like you're working in a single document.

## Features

-   Press the Up arrow key at the beginning of a note to move to the end of the previous note
-   Press the Down arrow key at the end of a note to move to the beginning of the next note
-   Automatically focuses the editor in the target note
-   Maintains a natural reading/editing flow between notes

## How It Works

The plugin registers a CodeMirror extension that intercepts the Up and Down arrow key events when the cursor is at the beginning or end of a document. When this happens, it:

1. Finds the adjacent note (previous or next)
2. Focuses that note
3. Positions the cursor at the appropriate position (end for up navigation, beginning for down navigation)
4. Ensures the cursor is visible by scrolling to it

## Implementation Details

The plugin uses the following components:

-   `createUpDownNavigationExtension`: Creates the CodeMirror extension that handles the key events
-   `findAdjacentLeaf`: Finds the adjacent leaf in the daily notes view
-   `navigateToAdjacentLeaf`: Handles the navigation to the adjacent leaf and focuses its editor

## Usage

This functionality is automatically enabled when the Obsidian Daily Notes Editor plugin is active. Simply use the arrow keys to navigate between notes as you would within a single document.

## Requirements

-   Obsidian Daily Notes Editor plugin
-   Obsidian v0.15.0 or higher
