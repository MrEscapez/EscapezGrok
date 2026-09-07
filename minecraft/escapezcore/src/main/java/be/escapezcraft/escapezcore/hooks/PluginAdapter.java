package be.escapezcraft.escapezcore.hooks;

/**
 * Soft-dependency adapter contract. Absent / disabled plugins never crash EscapezCore.
 */
public interface PluginAdapter {

    /** Stable integrations.yml / registry key (e.g. {@code luckperms}). */
    String id();

    /** Bukkit plugin name used for detection (e.g. {@code LuckPerms}). */
    String pluginName();

    /** How this adapter binds to the third-party plugin. */
    AdapterMode mode();

    /** Plugin jar is loaded and enabled on the server. */
    boolean isPresent();

    /** Allowed by integrations.yml (default true when missing). */
    boolean isConfigEnabled();

    /**
     * Ready for use: config-enabled, present, and hook succeeded.
     * Prefer this over raw {@link #isPresent()} for feature gates.
     */
    boolean isAvailable();

    /** Attempt bind; must never throw to callers — log and degrade. */
    void hook();

    /** Release references on disable / soft-reload rescan. */
    void unhook();

    /** Short Dutch/English status token for admin listing. */
    default String statusLabel() {
        if (!isConfigEnabled()) {
            return "disabled";
        }
        if (!isPresent()) {
            return "absent";
        }
        if (isAvailable()) {
            return "active";
        }
        return "present-unhooked";
    }
}
