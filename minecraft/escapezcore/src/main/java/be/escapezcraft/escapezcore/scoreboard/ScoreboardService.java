package be.escapezcraft.escapezcore.scoreboard;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.database.DatabaseModule;
import be.escapezcraft.escapezcore.database.PlayerPreferencesRepository;
import be.escapezcraft.escapezcore.messages.MessagesService;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.scoreboard.Criteria;
import org.bukkit.scoreboard.DisplaySlot;
import org.bukkit.scoreboard.Objective;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.Team;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

/**
 * Per-player sidebar with in-place team prefix updates (no flicker).
 * Heavy string prep stays lightweight; Bukkit scoreboard mutations always on main.
 */
public final class ScoreboardService {

    public static final String PREF_KEY = "scoreboard.enabled";
    private static final int MAX_LINES = 15;
    private static final String OBJECTIVE_NAME = "escapez_sb";

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final PlaceholderResolver placeholders;
    private final DatabaseModule databaseModule;
    private final org.bukkit.NamespacedKey pdcKey;

    private final Map<UUID, PlayerBoard> boards = new ConcurrentHashMap<>();
    private final Map<UUID, Boolean> visibilityCache = new ConcurrentHashMap<>();

    private BukkitTask refreshTask;
    private List<String> lineTemplates = List.of();
    private String titleTemplate = "";
    private int refreshTicks = 20;
    private boolean featureEnabled = true;
    private String worldMode = "all";
    private List<String> worldList = List.of();
    private boolean toggleEnabled = true;
    private String togglePermission = "escapezcore.scoreboard.toggle";
    private boolean defaultVisible = true;
    private String missingPapiMode = "leave";

    public ScoreboardService(
            EscapezCorePlugin plugin,
            ConfigManager configManager,
            MessagesService messages,
            PlaceholderResolver placeholders,
            DatabaseModule databaseModule
    ) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
        this.placeholders = placeholders;
        this.databaseModule = databaseModule;
        this.pdcKey = new org.bukkit.NamespacedKey(plugin, "scoreboard_visible");
    }

    public void loadSettings() {
        FileConfiguration cfg = configManager.getScoreboard();
        ConfigurationSection section = cfg == null ? null : cfg.getConfigurationSection("scoreboard");
        if (section == null) {
            featureEnabled = false;
            lineTemplates = List.of();
            return;
        }
        featureEnabled = section.getBoolean("enabled", true);
        refreshTicks = Math.max(5, section.getInt("refresh-ticks", 20));
        titleTemplate = section.getString("title", "<bold>EscapezCraft</bold>");
        lineTemplates = new ArrayList<>(section.getStringList("lines"));
        if (lineTemplates.size() > MAX_LINES) {
            lineTemplates = new ArrayList<>(lineTemplates.subList(0, MAX_LINES));
        }
        ConfigurationSection worlds = section.getConfigurationSection("worlds");
        if (worlds != null) {
            worldMode = worlds.getString("mode", "all").toLowerCase();
            worldList = worlds.getStringList("list").stream()
                    .map(String::toLowerCase)
                    .toList();
        } else {
            worldMode = "all";
            worldList = List.of();
        }
        ConfigurationSection toggle = section.getConfigurationSection("toggle");
        if (toggle != null) {
            toggleEnabled = toggle.getBoolean("enabled", true);
            togglePermission = toggle.getString("permission", "escapezcore.scoreboard.toggle");
            defaultVisible = toggle.getBoolean("default-visible", true);
        } else {
            toggleEnabled = true;
            togglePermission = "escapezcore.scoreboard.toggle";
            defaultVisible = true;
        }
        missingPapiMode = section.getString("missing-papi", "leave");
        placeholders.refresh();
    }

    public void start() {
        stopTask();
        loadSettings();
        if (!featureEnabled) {
            clearAll();
            plugin.getLogger().info("Scoreboard uitgeschakeld in scoreboard.yml.");
            return;
        }
        for (Player player : Bukkit.getOnlinePlayers()) {
            setupPlayer(player);
        }
        refreshTask = Bukkit.getScheduler().runTaskTimer(plugin, this::tickAll, refreshTicks, refreshTicks);
        plugin.getLogger().info("Scoreboard actief (refresh=" + refreshTicks + " ticks, regels="
                + lineTemplates.size() + ").");
    }

    public void stop() {
        stopTask();
        clearAll();
    }

    public void reload() {
        loadSettings();
        stopTask();
        if (!featureEnabled) {
            clearAll();
            return;
        }
        // Recreate boards so line-count / title changes apply without flicker loops
        for (Player player : Bukkit.getOnlinePlayers()) {
            removeBoard(player, false);
            setupPlayer(player);
        }
        refreshTask = Bukkit.getScheduler().runTaskTimer(plugin, this::tickAll, refreshTicks, refreshTicks);
    }

    private void stopTask() {
        if (refreshTask != null) {
            refreshTask.cancel();
            refreshTask = null;
        }
    }

    private void clearAll() {
        for (Player player : Bukkit.getOnlinePlayers()) {
            removeBoard(player, true);
        }
        boards.clear();
    }

    public void setupPlayer(Player player) {
        if (!featureEnabled || player == null) {
            return;
        }
        loadVisibility(player);
        if (!shouldShow(player)) {
            removeBoard(player, true);
            return;
        }
        PlayerBoard existing = boards.get(player.getUniqueId());
        if (existing == null) {
            boards.put(player.getUniqueId(), createBoard(player));
        }
        updatePlayer(player);
    }

    public void handleQuit(Player player) {
        if (player == null) {
            return;
        }
        boards.remove(player.getUniqueId());
        // Keep visibilityCache for short reconnects; prune on disable
    }

    public void handleWorldChange(Player player) {
        if (!featureEnabled || player == null) {
            return;
        }
        if (!shouldShow(player)) {
            removeBoard(player, true);
        } else {
            setupPlayer(player);
        }
    }

    private void tickAll() {
        if (!featureEnabled) {
            return;
        }
        for (Player player : Bukkit.getOnlinePlayers()) {
            if (!shouldShow(player)) {
                removeBoard(player, true);
                continue;
            }
            if (!boards.containsKey(player.getUniqueId())) {
                setupPlayer(player);
            } else {
                updatePlayer(player);
            }
        }
    }

    private boolean shouldShow(Player player) {
        if (!featureEnabled) {
            return false;
        }
        if (!isWorldAllowed(player.getWorld().getName())) {
            return false;
        }
        return isVisible(player.getUniqueId());
    }

    private boolean isWorldAllowed(String worldName) {
        String lower = worldName.toLowerCase();
        return switch (worldMode) {
            case "whitelist" -> worldList.contains(lower);
            case "blacklist" -> !worldList.contains(lower);
            default -> true;
        };
    }

    public boolean isVisible(UUID uuid) {
        Boolean cached = visibilityCache.get(uuid);
        if (cached != null) {
            return cached;
        }
        return defaultVisible;
    }

    public boolean isToggleEnabled() {
        return toggleEnabled;
    }

    public String getTogglePermission() {
        return togglePermission;
    }

    public boolean isFeatureEnabled() {
        return featureEnabled;
    }

    /**
     * Toggle and persist (PDC always; DB when ready). Returns new visibility.
     */
    public boolean toggle(Player player) {
        boolean next = !isVisible(player.getUniqueId());
        setVisible(player, next);
        return next;
    }

    public void setVisible(Player player, boolean visible) {
        UUID uuid = player.getUniqueId();
        visibilityCache.put(uuid, visible);
        player.getPersistentDataContainer().set(pdcKey, PersistentDataType.BYTE, (byte) (visible ? 1 : 0));
        persistDbAsync(uuid, visible);
        if (visible && featureEnabled) {
            setupPlayer(player);
        } else {
            removeBoard(player, true);
        }
    }

    private void loadVisibility(Player player) {
        UUID uuid = player.getUniqueId();
        if (visibilityCache.containsKey(uuid)) {
            return;
        }
        Byte pdc = player.getPersistentDataContainer().get(pdcKey, PersistentDataType.BYTE);
        if (pdc != null) {
            visibilityCache.put(uuid, pdc == 1);
            return;
        }
        visibilityCache.put(uuid, defaultVisible);
        // Optional DB override when ready — never block main
        if (databaseModule != null && databaseModule.isReady()) {
            PlayerPreferencesRepository repo = databaseModule.getPreferencesRepository();
            if (repo != null) {
                repo.get(uuid, PREF_KEY).whenComplete((opt, err) -> {
                    if (err != null || opt == null || opt.isEmpty()) {
                        return;
                    }
                    boolean fromDb = parseBool(opt.get(), defaultVisible);
                    visibilityCache.put(uuid, fromDb);
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        Player online = Bukkit.getPlayer(uuid);
                        if (online != null) {
                            online.getPersistentDataContainer().set(
                                    pdcKey, PersistentDataType.BYTE, (byte) (fromDb ? 1 : 0));
                            if (fromDb) {
                                setupPlayer(online);
                            } else {
                                removeBoard(online, true);
                            }
                        }
                    });
                });
            }
        }
    }

    private void persistDbAsync(UUID uuid, boolean visible) {
        if (databaseModule == null || !databaseModule.isReady()) {
            return;
        }
        PlayerPreferencesRepository repo = databaseModule.getPreferencesRepository();
        if (repo == null) {
            return;
        }
        repo.set(uuid, PREF_KEY, visible ? "true" : "false")
                .whenComplete((ignored, error) -> {
                    if (error != null) {
                        plugin.debugLog("Scoreboard pref save failed: " + error.getMessage());
                    }
                });
    }

    private static boolean parseBool(String raw, boolean fallback) {
        if (raw == null) {
            return fallback;
        }
        return switch (raw.trim().toLowerCase()) {
            case "true", "1", "yes", "aan", "on" -> true;
            case "false", "0", "no", "uit", "off" -> false;
            default -> fallback;
        };
    }

    private PlayerBoard createBoard(Player player) {
        Scoreboard scoreboard = Bukkit.getScoreboardManager().getNewScoreboard();
        Objective objective = scoreboard.registerNewObjective(
                OBJECTIVE_NAME, Criteria.DUMMY, Component.empty());
        objective.setDisplaySlot(DisplaySlot.SIDEBAR);

        int lineCount = Math.max(1, lineTemplates.size());
        String[] entries = new String[lineCount];
        Team[] teams = new Team[lineCount];
        Component[] lastLines = new Component[lineCount];

        for (int i = 0; i < lineCount; i++) {
            String entry = entryKey(i);
            entries[i] = entry;
            Team team = scoreboard.registerNewTeam("ec_l" + i);
            team.addEntry(entry);
            team.prefix(Component.empty());
            teams[i] = team;
            // Higher score = higher on sidebar
            objective.getScore(entry).setScore(lineCount - i);
            lastLines[i] = null;
        }

        player.setScoreboard(scoreboard);
        return new PlayerBoard(scoreboard, objective, entries, teams, lastLines, null);
    }

    private void updatePlayer(Player player) {
        PlayerBoard board = boards.get(player.getUniqueId());
        if (board == null) {
            return;
        }
        try {
            String titleRaw = placeholders.resolve(player, titleTemplate, missingPapiMode);
            Component title = messages.parse(titleRaw);
            if (board.lastTitle == null || !board.lastTitle.equals(title)) {
                board.objective.displayName(title);
                board.lastTitle = title;
            }

            int count = board.entries.length;
            for (int i = 0; i < count; i++) {
                String template = i < lineTemplates.size() ? lineTemplates.get(i) : "";
                String resolved = placeholders.resolve(player, template == null ? "" : template, missingPapiMode);
                Component line = resolved.isEmpty()
                        ? Component.empty()
                        : messages.parse(resolved);
                if (board.lastLines[i] == null || !board.lastLines[i].equals(line)) {
                    board.teams[i].prefix(line);
                    board.lastLines[i] = line;
                }
            }

            // Ensure player still uses our board (other plugins may steal it)
            if (player.getScoreboard() != board.scoreboard) {
                player.setScoreboard(board.scoreboard);
            }
        } catch (Exception ex) {
            plugin.getLogger().log(Level.FINE, "Scoreboard update failed for " + player.getName(), ex);
        }
    }

    private void removeBoard(Player player, boolean resetToMain) {
        boards.remove(player.getUniqueId());
        if (resetToMain && player.isOnline()) {
            try {
                player.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
            } catch (Exception ignored) {
                // ignore
            }
        }
    }

    /**
     * Unique entry keys so team prefixes carry the visible MiniMessage content.
     * Uses legacy section codes only as scoreboard entry identities (not displayed).
     */
    private static String entryKey(int index) {
        // Distinct combinations of color codes as unique team entries
        char[] hex = "0123456789abcdef".toCharArray();
        char a = hex[index % 16];
        char b = hex[(index / 16) % 16];
        return "§" + a + "§" + b + "§r";
    }

    public void clearVisibilityCache() {
        visibilityCache.clear();
    }

    private static final class PlayerBoard {
        private final Scoreboard scoreboard;
        private final Objective objective;
        private final String[] entries;
        private final Team[] teams;
        private final Component[] lastLines;
        private Component lastTitle;

        private PlayerBoard(
                Scoreboard scoreboard,
                Objective objective,
                String[] entries,
                Team[] teams,
                Component[] lastLines,
                Component lastTitle
        ) {
            this.scoreboard = scoreboard;
            this.objective = objective;
            this.entries = entries;
            this.teams = teams;
            this.lastLines = lastLines;
            this.lastTitle = lastTitle;
        }
    }
}
