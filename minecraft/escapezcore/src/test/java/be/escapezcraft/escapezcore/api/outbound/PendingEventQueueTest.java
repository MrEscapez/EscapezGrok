package be.escapezcraft.escapezcore.api.outbound;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PendingEventQueueTest {

    @Test
    void offerAndDrainPreserveOrder() {
        PendingEventQueue queue = new PendingEventQueue(20);
        queue.offer("report.created", Map.of("id", "1"), "t1");
        queue.offer("report.created", Map.of("id", "2"), "t2");

        List<Map<String, Object>> drained = queue.drain(10);
        assertEquals(2, drained.size());
        assertEquals("1", ((Map<?, ?>) drained.get(0).get("payload")).get("id"));
        assertEquals("2", ((Map<?, ?>) drained.get(1).get("payload")).get("id"));
        assertEquals(0, queue.size());
    }

    @Test
    void offerDropsOldestWhenFull() {
        PendingEventQueue queue = new PendingEventQueue(10);
        for (int i = 0; i < 12; i++) {
            queue.offer("evt", Map.of("n", String.valueOf(i)), "t" + i);
        }
        assertEquals(10, queue.size());
        List<Map<String, Object>> drained = queue.drain(20);
        assertEquals(10, drained.size());
        assertEquals("2", ((Map<?, ?>) drained.get(0).get("payload")).get("n"));
        assertEquals("11", ((Map<?, ?>) drained.get(9).get("payload")).get("n"));
    }

    @Test
    void requeueFrontRestoresFailedBatch() {
        PendingEventQueue queue = new PendingEventQueue(20);
        queue.offer("a", Map.of("x", "1"), "t");
        List<Map<String, Object>> batch = queue.drain(1);
        queue.offer("b", Map.of("x", "2"), "t");
        queue.requeueFront(batch);

        List<Map<String, Object>> all = queue.drain(10);
        assertEquals(2, all.size());
        assertEquals("a", all.get(0).get("type"));
        assertEquals("b", all.get(1).get("type"));
        assertTrue(queue.size() == 0);
    }
}
