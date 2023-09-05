export interface SnapInstance {
  id: number;
  userId: number;
  snapShapeId: number;
  instanceKey: string;

  timerStarted: boolean;
  timerDurationMinutes: number;
  timerDurationSeconds: number;
  timerStartAt: Date | null;

  imageKey: string | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;
}
