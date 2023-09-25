export interface SnapInstanceUser {
  id: number;
  userId: number;
  snapInstanceId: number;
  locationId: number | null;

  isOwner: boolean;
  isJoined: boolean;
  joinedAt: Date | null;

  s3Key: string | null;
  snappedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;
}
