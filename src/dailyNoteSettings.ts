import DailyNoteViewPlugin from "./dailyNoteViewIndex";
import { App, debounce, PluginSettingTab, Setting } from "obsidian";

export interface DailyNoteSettings {
    hideFrontmatter: boolean;
    hideBacklinks: boolean;
    createAndOpenOnStartup: boolean;
}

export const DEFAULT_SETTINGS: DailyNoteSettings = {
    hideFrontmatter: false,
    hideBacklinks: false,
    createAndOpenOnStartup: false,
};

export class DailyNoteSettingTab extends PluginSettingTab {
    plugin: DailyNoteViewPlugin;

    constructor(app: App, plugin: DailyNoteViewPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    debounceApplySettingsUpdate = debounce(
        async () => {
            await this.plugin.saveSettings();
        },
        200,
        true
    );

    debounceDisplay = debounce(
        async () => {
            await this.display();
        },
        400,
        true
    );

    applySettingsUpdate() {
        this.debounceApplySettingsUpdate();
    }

    async display() {
        await this.plugin.loadSettings();

        const { containerEl } = this;
        const settings = this.plugin.settings;

        containerEl.toggleClass("daily-note-settings-container", true);

        containerEl.empty();

        new Setting(containerEl)
            .setName("Hide frontmatter")
            .setDesc("Hide frontmatter in daily notes")
            .addToggle((toggle) =>
                toggle
                    .setValue(settings.hideFrontmatter)
                    .onChange(async (value) => {
                        this.plugin.settings.hideFrontmatter = value;

                        document.body.classList.toggle(
                            "daily-notes-hide-frontmatter",
                            value
                        );
                        this.applySettingsUpdate();
                    })
            );

        new Setting(containerEl)
            .setName("Hide backlinks")
            .setDesc("Hide backlinks in daily notes")
            .addToggle((toggle) =>
                toggle
                    .setValue(settings.hideBacklinks)
                    .onChange(async (value) => {
                        this.plugin.settings.hideBacklinks = value;

                        document.body.classList.toggle(
                            "daily-notes-hide-backlinks",
                            value
                        );
                        this.applySettingsUpdate();
                    })
            );

        new Setting(containerEl)
            .setName("Create and open Daily Notes Editor on startup")
            .setDesc(
                "Automatically create today's daily note and open the Daily Notes Editor when Obsidian starts"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(settings.createAndOpenOnStartup)
                    .onChange(async (value) => {
                        this.plugin.settings.createAndOpenOnStartup = value;
                        this.applySettingsUpdate();
                    })
            );
    }
}
