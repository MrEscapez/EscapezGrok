package be.escapezcraft.escapezcore.api.dto;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Module status DTO for Staff Panel Settings toggles.
 * Contract ids: scoreboard, tips, vote, resourcepack, reports, staffchat, items.
 */
public record ModuleStatusDto(
        String id,
        String name,
        boolean enabled,
        boolean active,
        boolean reloadable
) {
    public Map<String, Object> toJson() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", id);
        map.put("name", name);
        map.put("enabled", enabled);
        map.put("active", active);
        map.put("reloadable", reloadable);
        return map;
    }
}
