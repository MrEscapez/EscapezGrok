package be.escapezcraft.escapezcore.config;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.module.Module;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.logging.Level;

/**
 * UTF-8 YAML config loader with config-version aware default merge.
 */
public final class ConfigManager implements Module {

    public static final int CURRENT_CONFIG_VERSION = 4;

    private final EscapezCorePlugin plugin;
    private FileConfiguration config;
    private FileConfiguration messages;
    private FileConfiguration commands;
    private FileConfiguration aliases;
    private FileConfiguration gui;

    public ConfigManager(EscapezCorePlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public String getName() {
        return "ConfigManager";
    }

    @Override
    public void enable() {
        loadAll();
    }

    @Override
    public void disable() {
        // nothing to close
    }

    @Override
    public void reload() {
        loadAll();
        plugin.getLogger().info("Configs herladen (UTF-8).");
    }

    public void loadAll() {
        this.config = loadMerged("config.yml");
        this.messages = loadMerged("messages.yml");
        this.commands = loadMerged("commands.yml");
        this.aliases = loadMerged("aliases.yml");
        this.gui = loadMerged("gui.yml");
        mergeConfigVersion();
    }

    private FileConfiguration loadMerged(String fileName) {
        File file = new File(plugin.getDataFolder(), fileName);
        if (!file.exists()) {
            plugin.saveResource(fileName, false);
        }
        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(file);

        try (InputStream in = plugin.getResource(fileName)) {
            if (in != null) {
                YamlConfiguration defaults = YamlConfiguration.loadConfiguration(
                        new InputStreamReader(in, StandardCharsets.UTF_8));
                yaml.setDefaults(defaults);
                yaml.options().copyDefaults(true);
                // Ensure missing keys from jar defaults are written
                mergeMissingKeys(yaml, defaults);
                yaml.save(file);
            }
        } catch (Exception ex) {
            plugin.getLogger().log(Level.WARNING, "Kon defaults niet mergen voor " + fileName, ex);
        }
        return yaml;
    }

    private void mergeMissingKeys(FileConfiguration target, FileConfiguration defaults) {
        Set<String> keys = defaults.getKeys(true);
        for (String key : keys) {
            if (!target.contains(key) && !(defaults.get(key) instanceof ConfigurationSection)) {
                target.set(key, defaults.get(key));
            }
        }
    }

    private void mergeConfigVersion() {
        int version = config.getInt("config-version", 0);
        if (version < CURRENT_CONFIG_VERSION) {
            config.set("config-version", CURRENT_CONFIG_VERSION);
            try {
                config.save(new File(plugin.getDataFolder(), "config.yml"));
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "Kon config-version niet opslaan", ex);
            }
            plugin.getLogger().info("config-version bijgewerkt naar " + CURRENT_CONFIG_VERSION);
        }
    }

    public FileConfiguration getConfig() {
        return config;
    }

    public FileConfiguration getMessages() {
        return messages;
    }

    public FileConfiguration getCommands() {
        return commands;
    }

    public FileConfiguration getAliases() {
        return aliases;
    }

    public FileConfiguration getGui() {
        return gui;
    }
}
