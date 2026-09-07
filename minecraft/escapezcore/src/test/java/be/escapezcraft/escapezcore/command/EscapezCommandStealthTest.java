package be.escapezcraft.escapezcore.command;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.gui.GuiModule;
import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.command.Command;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EscapezCommandStealthTest {

    @Mock
    private EscapezCorePlugin plugin;
    @Mock
    private ConfigManager configManager;
    @Mock
    private MessagesService messages;
    @Mock
    private GuiModule guiModule;
    @Mock
    private CommandModule commandModule;
    @Mock
    private Command command;
    @Mock
    private Player player;

    private EscapezCommand escapezCommand;

    @BeforeEach
    void setUp() {
        lenient().when(commandModule.getDefinitions()).thenReturn(Collections.emptyList());
        escapezCommand = new EscapezCommand(
                plugin, configManager, messages, guiModule, new CooldownService(), commandModule);
    }

    @Test
    void adminSubcommandHiddenWithoutPermission() {
        when(player.hasPermission(EscapezCommand.EC_PERMISSION)).thenReturn(true);
        when(player.hasPermission(EscapezCommand.ADMIN_PERMISSION)).thenReturn(false);

        boolean handled = escapezCommand.onCommand(player, command, "ec", new String[]{"admin"});

        assertTrue(handled);
        verify(messages).send(player, "unknown-subcommand");
        verify(messages, never()).send(eq(player), eq("no-permission"));
    }

    @Test
    void tabCompleteOmitsAdminWithoutPermission() {
        when(player.hasPermission(EscapezCommand.EC_PERMISSION)).thenReturn(true);
        when(player.hasPermission(EscapezCommand.ADMIN_PERMISSION)).thenReturn(false);
        when(player.hasPermission("escapezcore.command.report")).thenReturn(true);
        when(player.hasPermission("escapezcore.scoreboard.toggle")).thenReturn(true);

        List<String> completions = escapezCommand.onTabComplete(player, command, "ec", new String[]{""});

        assertFalse(completions.contains("admin"));
        assertTrue(completions.contains("help"));
        assertTrue(completions.contains("report"));
        assertTrue(completions.contains("scoreboard"));
    }

    @Test
    void tabCompleteIncludesAdminWithPermission() {
        when(player.hasPermission(EscapezCommand.EC_PERMISSION)).thenReturn(true);
        when(player.hasPermission(EscapezCommand.ADMIN_PERMISSION)).thenReturn(true);
        when(player.hasPermission("escapezcore.command.report")).thenReturn(false);
        when(player.hasPermission("escapezcore.scoreboard.toggle")).thenReturn(false);

        List<String> completions = escapezCommand.onTabComplete(player, command, "ec", new String[]{""});

        assertTrue(completions.contains("admin"));
        assertTrue(completions.contains("help"));
    }

    @Test
    void helpDoesNotLeakAdminEntriesWithoutPermission() {
        when(player.hasPermission(EscapezCommand.EC_PERMISSION)).thenReturn(true);
        when(player.hasPermission(EscapezCommand.ADMIN_PERMISSION)).thenReturn(false);
        when(player.hasPermission("escapezcore.command.report")).thenReturn(false);
        when(player.hasPermission("escapezcore.scoreboard.toggle")).thenReturn(false);
        when(player.hasPermission("escapezcore.staffchat")).thenReturn(false);
        when(player.hasPermission("escapezcore.report.manage")).thenReturn(false);

        escapezCommand.onCommand(player, command, "ec", new String[]{"help"});

        ArgumentCaptor<Map<String, String>> placeholders = ArgumentCaptor.forClass(Map.class);
        verify(messages, atLeastOnce()).sendRaw(eq(player), eq("help-line"), placeholders.capture());
        for (Map<String, String> map : placeholders.getAllValues()) {
            String cmd = map.getOrDefault("command", "");
            assertFalse(cmd.contains("admin"), "admin must not appear in help for non-admins: " + cmd);
        }
    }

    @Test
    void adminTabNestedEmptyWithoutPermissionEvenIfArgsLookAdmin() {
        when(player.hasPermission(EscapezCommand.EC_PERMISSION)).thenReturn(true);
        when(player.hasPermission(EscapezCommand.ADMIN_PERMISSION)).thenReturn(false);

        List<String> completions = escapezCommand.onTabComplete(
                player, command, "ec", new String[]{"admin", "reload"});

        assertTrue(completions.isEmpty());
    }
}
