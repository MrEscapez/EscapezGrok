package be.escapezcraft.escapezcore.hooks.adapters;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.hooks.AdapterMode;
import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.user.User;
import org.bukkit.entity.Player;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * LuckPerms soft-dep via official API (compileOnly {@code net.luckperms:api}).
 * Async user loads only — never {@code .join()}/{@code .get()} on the main thread.
 */
public final class LuckPermsAdapter extends AbstractPluginAdapter {

    private volatile LuckPerms api;

    public LuckPermsAdapter(EscapezCorePlugin plugin) {
        super(plugin, "luckperms", "LuckPerms", AdapterMode.COMPILE_ONLY);
    }

    @Override
    protected boolean onHook() {
        try {
            this.api = LuckPermsProvider.get();
            return this.api != null;
        } catch (IllegalStateException ex) {
            plugin.getLogger().warning("LuckPerms aanwezig maar API niet geregistreerd: " + ex.getMessage());
            this.api = null;
            return false;
        }
    }

    @Override
    protected void onUnhook() {
        this.api = null;
    }

    public Optional<LuckPerms> api() {
        return isAvailable() ? Optional.ofNullable(api) : Optional.empty();
    }

    /**
     * Cached primary group for an online player (safe on main thread — uses loaded user).
     */
    public Optional<String> primaryGroupCached(Player player) {
        if (!isAvailable() || api == null || player == null) {
            return Optional.empty();
        }
        User user = api.getUserManager().getUser(player.getUniqueId());
        if (user == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(user.getPrimaryGroup());
    }

    /**
     * Async user load — callers must not join/get on the Paper main thread.
     */
    public CompletableFuture<Optional<User>> loadUserAsync(UUID uuid) {
        if (!isAvailable() || api == null || uuid == null) {
            return CompletableFuture.completedFuture(Optional.empty());
        }
        return api.getUserManager().loadUser(uuid).thenApply(Optional::ofNullable);
    }
}
