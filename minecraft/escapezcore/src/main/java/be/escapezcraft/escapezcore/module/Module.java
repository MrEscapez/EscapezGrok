package be.escapezcraft.escapezcore.module;

/**
 * Lifecycle contract for EscapezCore modules.
 */
public interface Module {

    String getName();

    void enable() throws Exception;

    void disable();

    /**
     * Soft reload of module state (configs/messages). Never triggers Bukkit.reload().
     */
    default void reload() throws Exception {
        // optional
    }
}
