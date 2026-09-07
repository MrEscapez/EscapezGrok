package be.escapezcraft.escapezcore.api.outbound;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;

/**
 * In-memory pending queue for outbound bridge events when Staff Panel is offline.
 * Local module state is always authoritative; this only buffers push payloads.
 */
public final class PendingEventQueue {

    private final ArrayBlockingQueue<Map<String, Object>> queue;

    public PendingEventQueue(int max) {
        this.queue = new ArrayBlockingQueue<>(Math.max(10, max));
    }

    public synchronized void offer(String type, Map<String, Object> payload, String timestamp) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", type);
        event.put("payload", payload == null ? Map.of() : new LinkedHashMap<>(payload));
        event.put("timestamp", timestamp);
        if (!queue.offer(event)) {
            queue.poll();
            queue.offer(event);
        }
    }

    public synchronized List<Map<String, Object>> drain(int limit) {
        List<Map<String, Object>> out = new ArrayList<>();
        queue.drainTo(out, Math.max(1, limit));
        return out;
    }

    public int size() {
        return queue.size();
    }

    public synchronized void requeueFront(List<Map<String, Object>> events) {
        if (events == null || events.isEmpty()) {
            return;
        }
        List<Map<String, Object>> existing = new ArrayList<>();
        queue.drainTo(existing);
        for (Map<String, Object> e : events) {
            if (!queue.offer(e)) {
                break;
            }
        }
        for (Map<String, Object> e : existing) {
            if (!queue.offer(e)) {
                break;
            }
        }
    }
}
