package be.escapezcraft.escapezcore.module;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ModuleManagerTest {

    @Mock
    private EscapezCorePlugin plugin;

    private ModuleManager manager;
    private final List<String> events = new ArrayList<>();

    @BeforeEach
    void setUp() {
        lenient().when(plugin.getLogger()).thenReturn(Logger.getLogger("test"));
        manager = new ModuleManager(plugin);
    }

    @Test
    void enableAllThenDisableAllUsesReverseOrder() throws Exception {
        manager.register(recordingModule("A"));
        manager.register(recordingModule("B"));
        manager.register(recordingModule("C"));

        manager.enableAll();
        assertEquals(List.of("enable:A", "enable:B", "enable:C"), events);

        events.clear();
        manager.disableAll();
        assertEquals(List.of("disable:C", "disable:B", "disable:A"), events);
    }

    @Test
    void reloadSafeInvokesReloadOnEnabledModules() throws Exception {
        manager.register(recordingModule("X"));
        manager.register(recordingModule("Y"));
        manager.enableAll();
        events.clear();

        manager.reloadSafe();
        assertEquals(List.of("reload:X", "reload:Y"), events);
    }

    @Test
    void getByNameIsCaseInsensitive() {
        manager.register(recordingModule("Tips"));
        assertTrue(manager.getByName("tips").isPresent());
        assertTrue(manager.getByName("TIPS").isPresent());
    }

    private Module recordingModule(String name) {
        return new Module() {
            @Override
            public String getName() {
                return name;
            }

            @Override
            public void enable() {
                events.add("enable:" + name);
            }

            @Override
            public void disable() {
                events.add("disable:" + name);
            }

            @Override
            public void reload() {
                events.add("reload:" + name);
            }
        };
    }
}
