export interface SnapShape {
  id: number;
  name: string;
  numberOfUsers: number;
  iconKey: string;
  focusedIconKey: string;
  columns: number;
  rows: number;
  spacing: number;
  width: number;
  height: number;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  unarchived: boolean;
}

export interface SmallSnapShape {
  id: number;
  name: string;
  numberOfUsers: number;
  iconUrl: string;
  focusedIconUrl: string;
}
