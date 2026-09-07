package be.escapezcraft.escapezcore.command;

import org.bukkit.entity.Player;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CooldownServiceTest {

    private static final UUID PLAYER_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");

    @Mock
    private Player player;

    private CooldownService cooldowns;

    @BeforeEach
    void setUp() {
        cooldowns = new CooldownService();
        lenient().when(player.getUniqueId()).thenReturn(PLAYER_ID);
    }

    @Test
    void remainingIsZeroWhenNoCooldownRecorded() {
        when(player.hasPermission(CooldownService.BYPASS_PERMISSION)).thenReturn(false);

        assertEquals(0, cooldowns.remainingSeconds(player, "vote", 5));
    }

    @Test
    void remainingIsZeroWhenCooldownSecondsNonPositive() {
        assertEquals(0, cooldowns.remainingSeconds(player, "vote", 0));
        assertEquals(0, cooldowns.remainingSeconds(player, "vote", -1));
    }

    @Test
    void applyThenRemainingReflectsCooldown() {
        when(player.hasPermission(CooldownService.BYPASS_PERMISSION)).thenReturn(false);

        cooldowns.apply(player, "discord", 10);
        int remaining = cooldowns.remainingSeconds(player, "discord", 10);

        assertTrue(remaining >= 9 && remaining <= 10,
                "expected ~10s remaining, got " + remaining);
    }

    @Test
    void globalBypassSkipsApplyAndRemaining() {
        when(player.hasPermission(CooldownService.BYPASS_PERMISSION)).thenReturn(true);

        cooldowns.apply(player, "discord", 30);
        assertEquals(0, cooldowns.remainingSeconds(player, "discord", 30));
    }

    @Test
    void perCommandBypassSkipsCooldown() {
        when(player.hasPermission(CooldownService.BYPASS_PERMISSION)).thenReturn(false);
        when(player.hasPermission("escapezcore.command.vote.bypass")).thenReturn(true);

        cooldowns.apply(player, "vote", 20, "escapezcore.command.vote.bypass");
        assertEquals(0, cooldowns.remainingSeconds(player, "vote", 20, "escapezcore.command.vote.bypass"));
    }

    @Test
    void clearRemovesOnlyThatPlayer() {
        when(player.hasPermission(CooldownService.BYPASS_PERMISSION)).thenReturn(false);
        Player other = org.mockito.Mockito.mock(Player.class);
        UUID otherId = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        when(other.getUniqueId()).thenReturn(otherId);
        when(other.hasPermission(CooldownService.BYPASS_PERMISSION)).thenReturn(false);

        cooldowns.apply(player, "shop", 15);
        cooldowns.apply(other, "shop", 15);
        cooldowns.clear(PLAYER_ID);

        assertEquals(0, cooldowns.remainingSeconds(player, "shop", 15));
        assertTrue(cooldowns.remainingSeconds(other, "shop", 15) > 0);
    }

    @Test
    void clearAllEmptiesMap() {
        when(player.hasPermission(CooldownService.BYPASS_PERMISSION)).thenReturn(false);

        cooldowns.apply(player, "website", 8);
        cooldowns.clearAll();

        assertEquals(0, cooldowns.remainingSeconds(player, "website", 8));
    }
}
