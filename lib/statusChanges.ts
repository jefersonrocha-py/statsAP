import "server-only";

import type { PoolConnection } from "mysql2/promise";
import { dbExecute } from "@lib/mysql";
import type { PendingEmit } from "@lib/sse";

export type StatusTransition = {
  antennaId: number;
  antennaName: string;
  networkName: string | null;
  previousStatus: string;
  status: "UP" | "DOWN";
  at: Date;
};

// Ponto único para qualquer mudança de status de AP (sync ou alteração manual).
// Grava o histórico e devolve os eventos SSE a emitir após o commit.
export async function recordStatusTransition(
  connection: PoolConnection,
  transition: StatusTransition
): Promise<PendingEmit[]> {
  await dbExecute(
    "INSERT INTO `StatusHistory` (`antennaId`, `status`, `changedAt`) VALUES (?, ?, ?)",
    [transition.antennaId, transition.status, transition.at],
    connection
  );

  return [
    {
      event: "status.changed",
      payload: {
        id: transition.antennaId,
        name: transition.antennaName,
        networkName: transition.networkName,
        previousStatus: transition.previousStatus,
        status: transition.status,
        at: transition.at.toISOString(),
      },
    },
  ];
}
