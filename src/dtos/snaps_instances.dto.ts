export interface CreateSnapInstaceDto {
  userId: number;
  snapShapeId: number;

  key: string;

  users: Array<{
    id: number;
    position: string;
  }>;
}
