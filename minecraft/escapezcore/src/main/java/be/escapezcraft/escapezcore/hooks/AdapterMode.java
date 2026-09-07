package be.escapezcraft.escapezcore.hooks;

/**
 * How a soft-dep adapter is implemented.
 */
public enum AdapterMode {
    /** Public Maven API as compileOnly — real method signatures only. */
    COMPILE_ONLY,
    /** Known public classes via reflection — no invented APIs. */
    REFLECTION,
    /** Presence detection only — no API wrappers. */
    DETECT_ONLY
}
