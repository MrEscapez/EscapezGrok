package be.escapezcraft.escapezcore.report;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Async persistence for player reports. Implementations must never touch the main thread for I/O.
 */
public interface ReportRepository {

    CompletableFuture<Void> initialize();

    CompletableFuture<Report> create(
            UUID reporterUuid,
            String reporterName,
            UUID targetUuid,
            String targetName,
            String reason
    );

    CompletableFuture<Optional<Report>> findById(long id);

    /**
     * @param status filter, or null for all
     */
    CompletableFuture<List<Report>> list(ReportStatus status, int offset, int limit);

    CompletableFuture<Boolean> update(Report report);

    String backendName();

    CompletableFuture<Void> close();
}
