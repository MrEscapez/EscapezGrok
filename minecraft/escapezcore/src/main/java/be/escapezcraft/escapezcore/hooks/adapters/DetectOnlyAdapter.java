package be.escapezcraft.escapezcore.hooks.adapters;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.hooks.AdapterMode;

/**
 * Presence-only soft-dep — no third-party method calls.
 */
public final class DetectOnlyAdapter extends AbstractPluginAdapter {

    public DetectOnlyAdapter(EscapezCorePlugin plugin, String id, String pluginName) {
        super(plugin, id, pluginName, AdapterMode.DETECT_ONLY);
    }

    @Override
    protected boolean onHook() {
        // Detection is sufficient; available iff present + config-enabled.
        return true;
    }
}
