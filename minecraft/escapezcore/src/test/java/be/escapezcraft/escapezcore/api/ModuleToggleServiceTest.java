package be.escapezcraft.escapezcore.api;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.api.dto.ModuleStatusDto;
import be.escapezcraft.escapezcore.config.ConfigManager;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitScheduler;
import org.bukkit.scheduler.BukkitTask;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ModuleToggleServiceTest {

    @Mock
    private EscapezCorePlugin plugin;

    @Mock
    private ConfigManager configManager;

    @Test
    void moduleIdsMatchStaffPanelContract() {
        assertEquals(
                List.of("scoreboard", "tips", "vote", "resourcepack", "reports", "staffchat", "items"),
                ModuleToggleService.MODULE_IDS
        );
    }

    @Test
    void listModulesReturnsAllContractIdsWithDefaults() {
        lenient().when(plugin.getScoreboardModule()).thenReturn(null);
        lenient().when(plugin.getTipsModule()).thenReturn(null);
        lenient().when(plugin.getReportModule()).thenReturn(null);
        lenient().when(plugin.getStaffChatModule()).thenReturn(null);
        lenient().when(plugin.getItemsModule()).thenReturn(null);
        lenient().when(configManager.getScoreboard()).thenReturn(null);
        lenient().when(configManager.getConfig()).thenReturn(null);
        lenient().when(configManager.getResourcePack()).thenReturn(null);
        lenient().when(configManager.getItems()).thenReturn(null);

        ModuleToggleService service = new ModuleToggleService(plugin, configManager);
        List<ModuleStatusDto> list = service.listModules();

        assertEquals(7, list.size());
        assertEquals(ModuleToggleService.MODULE_IDS, list.stream().map(ModuleStatusDto::id).toList());
        assertTrue(list.stream().allMatch(ModuleStatusDto::reloadable));
    }

    @Test
    void setEnabledFailsFastOnPrimaryThreadWithoutScheduling() {
        ModuleToggleService service = new ModuleToggleService(plugin, configManager);

        try (MockedStatic<Bukkit> bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);

            CompletableFuture<ModuleStatusDto> future = service.setEnabled("tips", false);

            assertTrue(future.isCompletedExceptionally());
            assertInstanceOf(IllegalStateException.class, future.exceptionNow());
        }
    }

    @Test
    void setEnabledBlockingRejectsPrimaryThread() {
        ModuleToggleService service = new ModuleToggleService(plugin, configManager);

        try (MockedStatic<Bukkit> bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);
            assertThrows(IllegalStateException.class,
                    () -> service.setEnabledBlocking("tips", true, 1000L));
        }
    }

    @Test
    void setEnabledSchedulesSoftReloadOnSchedulerWithoutJoining() {
        ModuleToggleService service = new ModuleToggleService(plugin, configManager);

        BukkitScheduler scheduler = mock(BukkitScheduler.class);
        AtomicReference<Runnable> scheduled = new AtomicReference<>();
        when(scheduler.runTask(any(Plugin.class), any(Runnable.class))).thenAnswer(inv -> {
            scheduled.set(inv.getArgument(1));
            return mock(BukkitTask.class);
        });

        try (MockedStatic<Bukkit> bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(false);
            bukkit.when(Bukkit::getScheduler).thenReturn(scheduler);

            CompletableFuture<ModuleStatusDto> future = service.setEnabled("scoreboard", false);

            // Soft-reload is scheduled on the Paper main thread; callers must not join on main.
            assertFalse(future.isDone(), "future must not complete via main-thread join");
            assertNotNull(scheduled.get(), "runTask should schedule soft-reload work");
        }
    }

    @Test
    void getModuleUnknownIsEmpty() {
        ModuleToggleService service = new ModuleToggleService(plugin, configManager);
        assertTrue(service.getModule("nope").isEmpty());
    }

    @Test
    void setEnabledUnknownModuleFails() {
        ModuleToggleService service = new ModuleToggleService(plugin, configManager);

        try (MockedStatic<Bukkit> bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(false);
            CompletableFuture<ModuleStatusDto> future = service.setEnabled("unknown-mod", true);
            assertTrue(future.isCompletedExceptionally());
            assertInstanceOf(ModuleToggleService.NotFoundException.class, future.exceptionNow());
        }
    }
}
