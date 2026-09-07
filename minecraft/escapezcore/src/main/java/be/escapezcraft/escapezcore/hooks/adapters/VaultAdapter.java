package be.escapezcraft.escapezcore.hooks.adapters;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.hooks.AdapterMode;
import net.milkbowl.vault.economy.Economy;
import net.milkbowl.vault.permission.Permission;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.RegisteredServiceProvider;

import java.util.Optional;

/**
 * Vault soft-dep via VaultAPI (compileOnly {@code com.github.MilkBowl:VaultAPI}).
 * Thin economy/permission wrappers only — no invented methods.
 */
public final class VaultAdapter extends AbstractPluginAdapter {

    private volatile Economy economy;
    private volatile Permission permission;

    public VaultAdapter(EscapezCorePlugin plugin) {
        super(plugin, "vault", "Vault", AdapterMode.COMPILE_ONLY);
    }

    @Override
    protected boolean onHook() {
        economy = null;
        permission = null;
        RegisteredServiceProvider<Economy> econRsp =
                Bukkit.getServicesManager().getRegistration(Economy.class);
        if (econRsp != null) {
            economy = econRsp.getProvider();
        }
        RegisteredServiceProvider<Permission> permRsp =
                Bukkit.getServicesManager().getRegistration(Permission.class);
        if (permRsp != null) {
            permission = permRsp.getProvider();
        }
        // Vault plugin present is enough to mark hooked; providers may appear later after soft-reload.
        return true;
    }

    @Override
    protected void onUnhook() {
        economy = null;
        permission = null;
    }

    public boolean hasEconomy() {
        return isAvailable() && economy != null;
    }

    public Optional<Economy> economy() {
        return hasEconomy() ? Optional.of(economy) : Optional.empty();
    }

    public boolean hasPermissionService() {
        return isAvailable() && permission != null;
    }

    public Optional<Permission> permission() {
        return hasPermissionService() ? Optional.of(permission) : Optional.empty();
    }

    public Optional<Double> balance(Player player) {
        if (!hasEconomy() || player == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(economy.getBalance(player));
        } catch (Throwable t) {
            plugin.debugLog("Vault getBalance: " + t.getMessage());
            return Optional.empty();
        }
    }

    public Optional<String> format(double amount) {
        if (!hasEconomy()) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(economy.format(amount));
        } catch (Throwable t) {
            plugin.debugLog("Vault format: " + t.getMessage());
            return Optional.empty();
        }
    }
}
