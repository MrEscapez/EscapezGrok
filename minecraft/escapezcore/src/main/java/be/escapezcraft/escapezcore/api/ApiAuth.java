package be.escapezcraft.escapezcore.api;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Bridge auth aligned with Staff Panel {@code bridge-auth.ts}:
 * <ul>
 *   <li>{@code X-Escapez-Api-Key} — required (shared with BRIDGE_API_KEY / ESCAPEZ_API_KEY)</li>
 *   <li>Optional HMAC: {@code X-Escapez-Timestamp} + {@code X-Escapez-Signature}
 *       = hex(HMAC-SHA256(timestamp + "." + rawBody, secret))</li>
 * </ul>
 */
public final class ApiAuth {

    public static final String HEADER_API_KEY = "X-Escapez-Api-Key";
    public static final String HEADER_TIMESTAMP = "X-Escapez-Timestamp";
    public static final String HEADER_SIGNATURE = "X-Escapez-Signature";

    /** Max clock skew for HMAC timestamps (5 minutes). */
    public static final long MAX_SKEW_MS = 5 * 60_000L;

    private ApiAuth() {
    }

    public static boolean constantTimeEqual(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        byte[] bufA = a.getBytes(StandardCharsets.UTF_8);
        byte[] bufB = b.getBytes(StandardCharsets.UTF_8);
        if (bufA.length != bufB.length) {
            MessageDigest.isEqual(bufA, bufA);
            return false;
        }
        return MessageDigest.isEqual(bufA, bufB);
    }

    public static boolean verifyInbound(ApiSettings settings, String apiKeyHeader,
                                       String timestampHeader, String signatureHeader,
                                       String rawBody) {
        if (!settings.hasApiKey()) {
            return false;
        }
        if (!constantTimeEqual(apiKeyHeader == null ? "" : apiKeyHeader, settings.apiKey())) {
            return false;
        }
        if (!settings.hmacEnabled()) {
            return true;
        }
        if (!settings.hasHmacSecret()) {
            return false;
        }
        if (timestampHeader == null || timestampHeader.isBlank()
                || signatureHeader == null || signatureHeader.isBlank()) {
            return false;
        }
        long ts;
        try {
            ts = Long.parseLong(timestampHeader.trim());
        } catch (NumberFormatException ex) {
            return false;
        }
        long now = System.currentTimeMillis();
        if (Math.abs(now - ts) > MAX_SKEW_MS) {
            return false;
        }
        String expected = sign(settings.hmacSecret(), timestampHeader.trim(),
                rawBody == null ? "" : rawBody);
        return constantTimeEqual(signatureHeader.trim().toLowerCase(Locale.ROOT),
                expected.toLowerCase(Locale.ROOT));
    }

    public static String sign(String secret, String timestamp, String rawBody) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal((timestamp + "." + rawBody).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("HMAC-SHA256 niet beschikbaar", ex);
        }
    }
}
