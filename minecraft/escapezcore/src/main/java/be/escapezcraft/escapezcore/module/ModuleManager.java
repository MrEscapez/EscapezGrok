package be.escapezcraft.escapezcore.module;

import be.escapezcraft.escapezcore.EscapezCorePlugin;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Level;

/**
 * Boots and tears down modules in registration order / reverse order.
 */
public final class ModuleManager {

    private final EscapezCorePlugin plugin;
    private final Map<String, Module> modules = new LinkedHashMap<>();
    private final List<Module> enabled = new ArrayList<>();

    public ModuleManager(EscapezCorePlugin plugin) {
        this.plugin = plugin;
    }

    public void register(Module module) {
        modules.put(module.getName().toLowerCase(), module);
    }

    public void enableAll() {
        for (Module module : modules.values()) {
            try {
                module.enable();
                enabled.add(module);
                plugin.getLogger().info("Module enabled: " + module.getName());
            } catch (Exception ex) {
                plugin.getLogger().log(Level.SEVERE, "Failed to enable module " + module.getName(), ex);
            }
        }
    }

    public void disableAll() {
        List<Module> reverse = new ArrayList<>(enabled);
        Collections.reverse(reverse);
        for (Module module : reverse) {
            try {
                module.disable();
                plugin.getLogger().info("Module disabled: " + module.getName());
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "Error disabling module " + module.getName(), ex);
            }
        }
        enabled.clear();
    }

    public void reloadSafe() throws Exception {
        Exception first = null;
        for (Module module : enabled) {
            try {
                module.reload();
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "Reload failed for " + module.getName(), ex);
                if (first == null) {
                    first = ex;
                }
            }
        }
        if (first != null) {
            throw first;
        }
    }

    @SuppressWarnings("unchecked")
    public <T extends Module> Optional<T> get(Class<T> type) {
        for (Module module : modules.values()) {
            if (type.isInstance(module)) {
                return Optional.of((T) module);
            }
        }
        return Optional.empty();
    }

    public Optional<Module> getByName(String name) {
        return Optional.ofNullable(modules.get(name.toLowerCase()));
    }
}
