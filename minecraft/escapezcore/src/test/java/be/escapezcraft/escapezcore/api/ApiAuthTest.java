package be.escapezcraft.escapezcore.api;

import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ApiAuthTest {

    @Test
    void constantTimeEqualRejectsNullAndMismatch() {
        assertFalse(ApiAuth.constantTimeEqual(null, "a"));
        assertFalse(ApiAuth.constantTimeEqual("a", null));
        assertFalse(ApiAuth.constantTimeEqual("abc", "abd"));
        assertTrue(ApiAuth.constantTimeEqual("same", "same"));
    }

    @Test
    void verifyInboundRequiresApiKey() {
        YamlConfiguration cfg = new YamlConfiguration();
        cfg.set("api.auth.api-key", "");
        ApiSettings empty = ApiSettings.fromConfig(cfg);
        assertFalse(ApiAuth.verifyInbound(empty, "anything", null, null, ""));
    }

    @Test
    void verifyInboundAcceptsMatchingKeyWithoutHmac() {
        YamlConfiguration cfg = new YamlConfiguration();
        cfg.set("api.auth.api-key", "test-bridge-key");
        cfg.set("api.auth.hmac-enabled", false);
        ApiSettings settings = ApiSettings.fromConfig(cfg);

        assertTrue(ApiAuth.verifyInbound(settings, "test-bridge-key", null, null, "{}"));
        assertFalse(ApiAuth.verifyInbound(settings, "wrong-key", null, null, "{}"));
    }

    @Test
    void verifyInboundValidatesHmacWhenEnabled() {
        YamlConfiguration cfg = new YamlConfiguration();
        cfg.set("api.auth.api-key", "test-bridge-key");
        cfg.set("api.auth.hmac-enabled", true);
        cfg.set("api.auth.hmac-secret", "test-hmac-secret");
        ApiSettings settings = ApiSettings.fromConfig(cfg);

        String body = "{\"enabled\":true}";
        String ts = String.valueOf(System.currentTimeMillis());
        String sig = ApiAuth.sign("test-hmac-secret", ts, body);

        assertTrue(ApiAuth.verifyInbound(settings, "test-bridge-key", ts, sig, body));
        assertFalse(ApiAuth.verifyInbound(settings, "test-bridge-key", ts, "deadbeef", body));
        assertFalse(ApiAuth.verifyInbound(settings, "test-bridge-key", null, sig, body));
    }

    @Test
    void signIsDeterministicHex() {
        String a = ApiAuth.sign("secret", "123", "body");
        String b = ApiAuth.sign("secret", "123", "body");
        assertEquals(a, b);
        assertEquals(64, a.length());
    }

    @Test
    void safeSummaryNeverIncludesSecretValues() {
        YamlConfiguration cfg = new YamlConfiguration();
        cfg.set("api.enabled", true);
        cfg.set("api.auth.api-key", "SUPER_SECRET_KEY_VALUE");
        cfg.set("api.auth.hmac-enabled", true);
        cfg.set("api.auth.hmac-secret", "SUPER_SECRET_HMAC_VALUE");
        ApiSettings settings = ApiSettings.fromConfig(cfg);

        String summary = settings.safeSummary();
        assertFalse(summary.contains("SUPER_SECRET_KEY_VALUE"));
        assertFalse(summary.contains("SUPER_SECRET_HMAC_VALUE"));
        assertTrue(summary.contains("apiKey=(config)"));
        assertTrue(summary.contains("hmac=aan"));
    }
}
