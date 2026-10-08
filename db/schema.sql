CREATE TABLE IF NOT EXISTS `Antenna` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) NOT NULL,
  `description` TEXT NULL,
  `lat` DOUBLE NOT NULL DEFAULT 0,
  `lon` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DOWN',
  `gdmsApId` VARCHAR(255) NULL,
  `networkId` VARCHAR(255) NULL,
  `networkName` VARCHAR(255) NULL,
  `lastSyncAt` DATETIME NULL,
  `lastStatusChange` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Antenna_gdmsApId_key` (`gdmsApId`),
  KEY `Antenna_status_idx` (`status`),
  KEY `Antenna_lat_lon_idx` (`lat`, `lon`),
  KEY `Antenna_gdmsApId_idx` (`gdmsApId`),
  KEY `Antenna_networkId_idx` (`networkId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StatusHistory` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `antennaId` INT NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `changedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `StatusHistory_antennaId_changedAt_idx` (`antennaId`, `changedAt`),
  CONSTRAINT `StatusHistory_antennaId_fkey`
    FOREIGN KEY (`antennaId`) REFERENCES `Antenna` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `User` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(200) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'USER',
  `isBlocked` BOOLEAN NOT NULL DEFAULT FALSE,
  `suspendedUntil` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`),
  KEY `User_role_idx` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PasswordResetToken` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `usedAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `PasswordResetToken_tokenHash_key` (`tokenHash`),
  KEY `PasswordResetToken_userId_idx` (`userId`),
  KEY `PasswordResetToken_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `PasswordResetToken_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gdms_token` (
  `id` INT NOT NULL,
  `accessToken` TEXT NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `UserInvite` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(200) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'USER',
  `tokenHash` CHAR(64) NOT NULL,
  `invitedById` INT NULL,
  `expiresAt` DATETIME NOT NULL,
  `acceptedAt` DATETIME NULL,
  `revokedAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UserInvite_tokenHash_key` (`tokenHash`),
  KEY `UserInvite_email_idx` (`email`),
  CONSTRAINT `UserInvite_invitedById_fkey`
    FOREIGN KEY (`invitedById`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SchemaMigration` (
  `name` VARCHAR(100) NOT NULL,
  `appliedAt` DATETIME NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Incident` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `antennaId` INT NULL,
  `antennaName` VARCHAR(80) NOT NULL,
  `networkName` VARCHAR(255) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  `resolution` VARCHAR(20) NULL,
  `wentDownAt` DATETIME NOT NULL,
  `lastDownAt` DATETIME NOT NULL,
  `recoveredAt` DATETIME NULL,
  `downCount` INT NOT NULL DEFAULT 1,
  `alertSentAt` DATETIME NULL,
  `recoveryAlertSentAt` DATETIME NULL,
  `resolvedAt` DATETIME NULL,
  `resolvedById` INT NULL,
  `resolvedByName` VARCHAR(100) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `Incident_status_lastDownAt_idx` (`status`, `lastDownAt`),
  KEY `Incident_antennaId_status_idx` (`antennaId`, `status`),
  KEY `Incident_createdAt_idx` (`createdAt`),
  CONSTRAINT `Incident_antennaId_fkey`
    FOREIGN KEY (`antennaId`) REFERENCES `Antenna` (`id`) ON DELETE SET NULL,
  CONSTRAINT `Incident_resolvedById_fkey`
    FOREIGN KEY (`resolvedById`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `IncidentEvent` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `incidentId` BIGINT NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `message` TEXT NULL,
  `fromStatus` VARCHAR(20) NULL,
  `toStatus` VARCHAR(20) NULL,
  `actorUserId` INT NULL,
  `actorName` VARCHAR(100) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IncidentEvent_incidentId_createdAt_idx` (`incidentId`, `createdAt`),
  CONSTRAINT `IncidentEvent_incidentId_fkey`
    FOREIGN KEY (`incidentId`) REFERENCES `Incident` (`id`) ON DELETE CASCADE,
  CONSTRAINT `IncidentEvent_actorUserId_fkey`
    FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
