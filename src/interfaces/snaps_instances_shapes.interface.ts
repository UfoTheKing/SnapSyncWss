export interface SnapInstanceShape {
  id: number;
  name: string;
  numberOfUsers: number;
  iconKey: string;
  focusedIconKey: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;
}
